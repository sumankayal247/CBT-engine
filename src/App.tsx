import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  CloudOff,
  LayoutDashboard,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import { Dashboard, Library, type LibraryActions } from './pages/Dashboard';
import { ImportExam } from './pages/ImportExam';
import { Instructions } from './pages/Instructions';
import { LiveExam } from './pages/LiveExam';
import { Results } from './pages/Results';
import { Scoreboard } from './pages/Scoreboard';
import { Settings } from './pages/Settings';
import { Modal } from './components/Common';
import { advanceTime, createAttempt } from './engine/attempt';
import {
  clearHistory,
  download,
  getPreference,
  listData,
  removeAttempt,
  removeExam,
  saveAttempt,
  saveExam,
  setPreference,
} from './engine/storage';
import { parseExam, type Exam } from './engine/schema';
import type { Attempt, ExamRecord } from './engine/types';
import { clock } from './engine/scoring';
type Screen =
  | 'dashboard'
  | 'library'
  | 'import'
  | 'instructions'
  | 'exam'
  | 'recovery'
  | 'results'
  | 'scoreboard'
  | 'settings';
const titles: Partial<Record<Screen, string>> = {
  dashboard: 'Overview',
  library: 'Exam library',
  import: 'Import examination',
  instructions: 'Candidate instructions',
  scoreboard: 'Scoreboard',
  results: 'Attempt results',
  settings: 'Settings & data',
};
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard'),
    [exams, setExams] = useState<ExamRecord[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [record, setRecord] = useState<ExamRecord>(),
    [editing, setEditing] = useState<ExamRecord>(),
    [selected, setSelected] = useState<Attempt>(),
    [active, setActive] = useState<Attempt>(),
    [candidate, setCandidateState] = useState('Practice candidate'),
    [historySearch, setHistorySearch] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [saveState, setSaveState] = useState('saved'),
    [online, setOnline] = useState(navigator.onLine),
    [menu, setMenu] = useState(false),
    [help, setHelp] = useState(false),
    [blocked, setBlocked] = useState(false),
    [lockReady, setLockReady] = useState(!navigator.locks),
    [tick, setTick] = useState(0);
  const activeRef = useRef<Attempt | undefined>(undefined),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    pending = useRef(0),
    dirty = useRef(false),
    alive = useRef(true);
  const report = useCallback(
    (e: unknown) =>
      setError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.'),
    [],
  );
  const refresh = useCallback(async () => {
    const data = await listData();
    setExams(data.exams.sort((a, b) => b.updatedAt - a.updatedAt));
    setAttempts(data.attempts);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!navigator.locks) return;
    let release: (() => void) | undefined,
      cancelled = false;
    // Defer one task: StrictMode's setup/cleanup probe must not contend with
    // its own asynchronous lock release on the subsequent real setup.
    const acquisition = window.setTimeout(() => {
      void navigator.locks
        .request('examdesk-single-writer', { ifAvailable: true }, async (lock) => {
          if (cancelled) return;
          if (!lock) {
            setBlocked(true);
            setLockReady(true);
            return;
          }
          setLockReady(true);
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        })
        .catch((e: unknown) => {
          if (!cancelled)
            report(
              new Error(
                `The browser could not secure local storage. Reload to retry. ${e instanceof Error ? e.message : ''}`,
              ),
            );
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(acquisition);
      release?.();
    };
  }, [report]);
  useEffect(() => {
    if (!lockReady || blocked) return;
    let cancel = false;
    void (async () => {
      try {
        const data = await listData();
        const pref = await getPreference('candidate', 'Practice candidate');
        if (cancel) return;
        setCandidateState(typeof pref === 'string' ? pref : 'Practice candidate');
        setExams(data.exams.sort((a, b) => b.updatedAt - a.updatedAt));
        setAttempts(data.attempts);
        const live = data.attempts.find((a) => a.status === 'active');
        if (live) {
          const next = advanceTime(live);
          await saveAttempt(next);
          if (cancel) return;
          activeRef.current = next;
          setActive(next);
          if (next.status === 'completed') {
            setSelected(next);
            setScreen('results');
            setAttempts(data.attempts.map((a) => (a.id === next.id ? next : a)));
          } else setScreen('recovery');
        }
      } catch (e) {
        report(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [blocked, lockReady, report]);
  const persist = useCallback(
    (next: Attempt) => {
      dirty.current = true;
      pending.current++;
      setSaveState('saving');
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          const saved = await saveAttempt(next);
          if (!alive.current) return;
          if (saved.status === 'completed') {
            setAttempts((rows) => [...rows.filter((a) => a.id !== saved.id), saved]);
            setSelected(saved);
          }
          if (pending.current === 1) {
            dirty.current = false;
            setSaveState('saved');
            setError('');
          }
        })
        .catch((e) => {
          setSaveState('error');
          report(
            new Error(
              `Local save failed: ${e instanceof Error ? e.message : 'Storage unavailable'}. Keep this tab open and retry. Export a backup when storage is available.`,
            ),
          );
        })
        .finally(() => {
          pending.current--;
        });
    },
    [report],
  );
  const update = useCallback(
    (change: (a: Attempt) => Attempt) => {
      const old = activeRef.current;
      if (!old || old.status !== 'active') return;
      try {
        const next = change(old);
        if (next === old) return;
        activeRef.current = next;
        setActive(next);
        persist(next);
        if (next.status === 'completed') {
          setSelected(next);
          setScreen('results');
        }
      } catch (e) {
        report(e);
      }
    },
    [persist, report],
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (activeRef.current?.status === 'active') {
        update((a) => advanceTime(a));
        setTick((t) => t + 1);
      }
    }, 500);
    const wake = () => update((a) => advanceTime(a));
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [update]);
  useEffect(() => {
    const net = () => setOnline(navigator.onLine),
      blocked = () =>
        setError('Database upgrade is blocked. Close other ExamDesk tabs and reload.');
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    window.addEventListener('database-blocked', blocked);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
      window.removeEventListener('database-blocked', blocked);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  const setCandidate = (name: string) => {
    setCandidateState(name);
    void setPreference('candidate', name).catch(report);
  };
  const go = (s: Screen) => {
    setScreen(s);
    setMenu(false);
    window.scrollTo(0, 0);
  };
  const openAttempt = (a: Attempt) => {
    setSelected(a);
    go('results');
  };
  const score = (name = '') => {
    setHistorySearch(name);
    go('scoreboard');
  };
  async function importExam(exam: Exam, existing?: ExamRecord) {
    if (
      existing &&
      !window.confirm(
        'Save this updated configuration? Historical attempts will retain their original snapshots.',
      )
    )
      return;
    if (
      !existing &&
      exams.some(
        (r) => r.exam.examName === exam.examName || (exam.examId && r.exam.examId === exam.examId),
      ) &&
      !window.confirm(
        'An examination with this name or examId already exists. Import a separate copy? Existing records will not be overwritten.',
      )
    )
      return;
    const now = Date.now();
    await saveExam({
      id: existing?.id ?? crypto.randomUUID(),
      exam,
      importedAt: existing?.importedAt ?? now,
      updatedAt: now,
    });
    await refresh();
    go('library');
  }
  const actions: LibraryActions = {
    start: (e) => {
      setRecord(e);
      go('instructions');
    },
    edit: (e) => {
      setEditing(e);
      go('import');
    },
    exportExam: (e) => download(`${e.exam.examCode || 'examination'}.json`, e.exam),
    duplicate: (e) => {
      void importExam({
        ...structuredClone(e.exam),
        examName: `${e.exam.examName} (copy)`,
        examId: undefined,
      }).catch(report);
    },
    remove: (e) => {
      if (
        window.confirm(
          `Remove “${e.exam.examName}” from the library? Previous attempts will be kept.`,
        )
      )
        void removeExam(e.id).then(refresh).catch(report);
    },
    history: (e) => score(e.exam.examName),
    importExam: () => {
      setEditing(undefined);
      go('import');
    },
  };
  async function loadExample() {
    try {
      const response = await fetch('/examples/demo-engineering.json');
      if (!response.ok)
        throw new Error('Example unavailable. Download or import your own JSON file.');
      const parsed = parseExam(await response.text());
      if (!parsed.exam) throw new Error('Example did not pass validation.');
      await importExam(parsed.exam);
    } catch (e) {
      report(e);
    }
  }
  async function start() {
    if (!record) return;
    if (dirty.current)
      throw new Error('Wait for the previous attempt to finish saving, or retry its save.');
    const next = createAttempt(record.id, record.exam, candidate);
    await saveAttempt(next);
    activeRef.current = next;
    setActive(next);
    setSaveState('saved');
    setError('');
    go('exam');
  }
  async function discard() {
    if (
      !active ||
      !window.confirm(
        'Permanently discard this unfinished attempt? All responses in this attempt will be deleted.',
      )
    )
      return;
    const old = activeRef.current;
    // A confirmation dialog can remain open past the deadline. Expiry wins.
    if (old && advanceTime(old).status === 'completed') {
      update((a) => advanceTime(a));
      return;
    }
    activeRef.current = undefined;
    try {
      await queue.current;
      await removeAttempt(active.id);
      setActive(undefined);
      await refresh();
      go('dashboard');
    } catch (e) {
      activeRef.current = old;
      report(e);
    }
  }
  if (blocked)
    return (
      <div className="loading-screen">
        <ShieldCheck size={38} />
        <h1>ExamDesk is open in another tab</h1>
        <p>Use that tab to keep your attempt consistent. Close it before continuing here.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="loading-screen">
        <span className="brand-mark">E</span>
        <h2>Opening your examination centre…</h2>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  if (active?.status === 'active' && (screen === 'exam' || screen === 'recovery')) {
    if (screen === 'recovery')
      return (
        <div className="recovery-page">
          <span className="brand-mark">E</span>
          <div className="card p-5">
            <div className="eyebrow">YOUR SESSION IS STILL HERE</div>
            <h1>Pick up where you left off.</h1>
            <h3>{active.exam.examName}</h3>
            <p>
              Your responses and question order have been recovered. The original deadline has not
              changed.
            </p>
            <div className="recovery-time" data-tick={tick}>
              {clock((active.deadline - Date.now()) / 1000)} <small>remaining</small>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="d-flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={() => {
                  update((a) => advanceTime(a));
                  if (activeRef.current?.status === 'active') go('exam');
                }}
              >
                Resume examination <ChevronRight size={17} />
              </button>
              <button className="btn btn-outline-danger" onClick={() => void discard()}>
                Discard attempt
              </button>
            </div>
          </div>
        </div>
      );
    return (
      <>
        {error && (
          <div role="alert" className="alert alert-danger mb-0 rounded-0">
            {error}
          </div>
        )}
        <LiveExam
          key={active.currentSection}
          attempt={active}
          update={update}
          saveState={saveState}
          onRetry={() => {
            if (activeRef.current) persist(activeRef.current);
          }}
        />
      </>
    );
  }
  return (
    <div className="app-layout">
      <aside className={`app-sidebar ${menu ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => go('dashboard')}>
          <span className="brand-mark">E</span>
          <span>
            ExamDesk<small>CBT PRACTICE ENGINE</small>
          </span>
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav>
          {(
            [
              ['dashboard', LayoutDashboard, 'Overview'],
              ['library', BookOpen, 'Exam library'],
              ['scoreboard', Trophy, 'Scoreboard'],
              ['settings', Settings2, 'Settings & data'],
            ] as const
          ).map(([s, Icon, label]) => (
            <button
              key={s}
              className={screen === s ? 'active' : ''}
              onClick={() => (s === 'scoreboard' ? score() : go(s))}
            >
              <Icon size={19} />
              {label}
              {s === 'library' && <span className="nav-count">{exams.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-import">
          <div className="sidebar-import-icon">
            <Plus size={20} />
          </div>
          <strong>Make it your examination.</strong>
          <p>
            Import a question bank and
            <br />
            start practising your way.
          </p>
          <button onClick={actions.importExam}>
            Import JSON <ChevronRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span>
            <ShieldCheck size={16} /> Local. Private. Yours.
          </span>
          <p>Built for focused preparation.</p>
          <small>ExamDesk v1.0</small>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="btn icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span className="topbar-workspace">Workspace</span>
            <ChevronRight size={13} />
            <strong>{titles[screen]}</strong>
          </div>
          <div>
            <span className="offline-badge">
              <span className={`live-dot ${online ? '' : 'is-offline'}`} />
              {online ? 'Local-first workspace' : 'You’re offline'}
            </span>
            <button
              className="btn icon-button"
              aria-label="Help and information"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <span className="topbar-avatar">
              {candidate.trim().slice(0, 1).toUpperCase() || 'P'}
            </span>
          </div>
        </header>
        <main className="page-container">
          {error && (
            <div className="alert alert-danger global-error" role="alert">
              <span>{error}</span>
              {dirty.current && activeRef.current ? (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => persist(activeRef.current!)}
                >
                  Retry save
                </button>
              ) : (
                <button
                  className="btn icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          {screen === 'dashboard' && (
            <Dashboard
              exams={exams}
              attempts={attempts}
              actions={actions}
              openAttempt={openAttempt}
              scoreboard={() => score()}
              loadExample={() => void loadExample()}
              library={() => go('library')}
            />
          )}
          {screen === 'library' && <Library exams={exams} actions={actions} />}
          {screen === 'import' && (
            <ImportExam
              key={editing?.id ?? 'new'}
              existing={editing}
              onSave={importExam}
              onCancel={() => go('library')}
            />
          )}
          {screen === 'instructions' && record && (
            <Instructions
              record={record}
              candidate={candidate}
              setCandidate={setCandidate}
              onStart={start}
              onCancel={() => go('dashboard')}
            />
          )}
          {screen === 'results' && selected?.result && (
            <Results
              key={selected.id}
              attempt={selected}
              onHome={() => go('dashboard')}
              onScoreboard={() => score()}
              onRetry={() => {
                setRecord({
                  id: selected.examId,
                  exam: selected.exam,
                  importedAt: selected.startedAt,
                  updatedAt: selected.startedAt,
                });
                go('instructions');
              }}
            />
          )}
          {screen === 'scoreboard' && (
            <Scoreboard
              key={historySearch}
              attempts={attempts}
              initialSearch={historySearch}
              onOpen={openAttempt}
              onDelete={(a) => {
                if (
                  window.confirm(
                    'Permanently delete this completed attempt and its responses? This cannot be undone.',
                  )
                )
                  void removeAttempt(a.id).then(refresh).catch(report);
              }}
              onClear={() => {
                if (
                  window.confirm(
                    'Permanently delete ALL completed attempts? Your examination library will be kept. Download a backup first.',
                  )
                )
                  void clearHistory().then(refresh).catch(report);
              }}
            />
          )}
          {screen === 'settings' && (
            <Settings candidate={candidate} setCandidate={setCandidate} onRestored={refresh} />
          )}
        </main>
        <footer className="app-footer">
          <span>ExamDesk · Built for your next attempt.</span>
          <span>
            <CloudOff size={14} /> Practice simulator. Not an official examination portal.
          </span>
        </footer>
      </div>
      {help && (
        <Modal title="Your offline examination workspace" onClose={() => setHelp(false)}>
          <p>
            Import a version 1.0 JSON examination, review its configuration, read the instructions
            and start. Your timer begins only on Start Examination.
          </p>
          <p>
            All question banks and attempts stay in this browser profile. Keep regular backups in
            Settings & data. Browser storage is not a secure answer-key vault or an official
            examination record.
          </p>
          <p>
            Keyboard: Tab to move between controls, Space or Enter to activate, and arrow keys in
            radio groups. No global shortcuts interfere with answer entry.
          </p>
          <a href="/FORMAT.md" target="_blank" rel="noreferrer">
            Read the JSON format guide
          </a>
          <p className="text-secondary mt-3 mb-0">
            Profiles are editable practice presets, not claims of exact official interface or
            marking-rule fidelity.
          </p>
        </Modal>
      )}
    </div>
  );
}
