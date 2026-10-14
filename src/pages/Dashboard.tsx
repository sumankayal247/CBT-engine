import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Clock3,
  Copy,
  FileJson,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import type { Attempt, ExamRecord } from '../engine/types';
import { profiles } from '../engine/profiles';
import { maxMarks, questionCount } from '../engine/schema';
import { dateTime, Empty, Stat } from '../components/Common';
import { round } from '../engine/scoring';
export type LibraryActions = {
  start: (e: ExamRecord) => void;
  edit: (e: ExamRecord) => void;
  exportExam: (e: ExamRecord) => void;
  duplicate: (e: ExamRecord) => void;
  remove: (e: ExamRecord) => void;
  history: (e: ExamRecord) => void;
  importExam: () => void;
};
export function ExamCard({ record, actions }: { record: ExamRecord; actions: LibraryActions }) {
  const [menu, setMenu] = useState(false),
    e = record.exam,
    p = profiles[e.examProfile];
  return (
    <article className="exam-card card">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <span className="profile-badge" style={{ color: p.accent }}>
          {p.short} <span>•</span> {e.sections.length} sections
        </span>
        <div className="position-relative">
          <button
            className="btn icon-button"
            title="Examination actions"
            aria-label={`Actions for ${e.examName}`}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div className="action-menu">
              {[
                [Settings2, 'Inspect / edit', actions.edit],
                [Clock3, 'Previous attempts', actions.history],
                [ArrowDownToLine, 'Export JSON', actions.exportExam],
                [Copy, 'Duplicate', actions.duplicate],
                [Trash2, 'Remove exam', actions.remove],
              ].map(([Icon, label, action]) => {
                const I = Icon as typeof Copy;
                return (
                  <button
                    key={label as string}
                    onClick={() => {
                      setMenu(false);
                      (action as (r: ExamRecord) => void)(record);
                    }}
                  >
                    <I size={15} />
                    {label as string}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <h3>{e.examName}</h3>
      <p className="exam-description">{e.description || p.description}</p>
      <div className="exam-meta">
        <span>
          <Clock3 size={14} />
          {round(e.durationSeconds / 60, 1)} min
        </span>
        <span>
          <FileJson size={14} />
          {questionCount(e)} questions
        </span>
        <span>
          <Target size={14} />
          {maxMarks(e)} marks
        </span>
      </div>
      <div className="exam-card-foot">
        <span>Ready to practice</span>
        <button className="btn btn-start" onClick={() => actions.start(record)}>
          Start exam <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}
export function Dashboard({
  exams,
  attempts,
  actions,
  openAttempt,
  scoreboard,
  loadExample,
  library,
}: {
  exams: ExamRecord[];
  attempts: Attempt[];
  actions: LibraryActions;
  openAttempt: (a: Attempt) => void;
  scoreboard: () => void;
  loadExample: () => void;
  library: () => void;
}) {
  const completed = attempts.filter((a) => a.result),
    passed = completed.filter((a) => a.result?.passed).length,
    best = completed.length ? Math.max(...completed.map((a) => a.result!.percentage)) : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PERSONAL EXAMINATION CENTRE</div>
          <h1>Practice with purpose.</h1>
          <p>A familiar exam environment. A clearer path to your next attempt.</p>
        </div>
        <button className="btn btn-primary" onClick={actions.importExam}>
          <Plus size={18} /> Import examination
        </button>
      </div>
      <section className="dashboard-hero">
        <div>
          <span className="hero-kicker">
            <span className="live-dot" /> PREPARED FOR THE REAL THING
          </span>
          <h2>
            Your exam. Your pace.
            <br />
            <span>Your next breakthrough.</span>
          </h2>
          <p>
            Bring your question bank. Experience a focused CBT session.
            <br className="d-none d-lg-block" /> Track every attempt, all on your own device.
          </p>
          <button className="btn btn-lime" onClick={actions.importExam}>
            Import an exam <ArrowRight size={17} />
          </button>
          <button className="hero-link" onClick={loadExample}>
            Try the demo paper <ArrowRight size={15} />
          </button>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="paper-graphic">
            <div className="paper-top">
              <span>CBT PRACTICE</span>
              <span>01:20:00</span>
            </div>
            <div className="paper-line long" />
            <div className="paper-line" />
            <div className="mock-option">
              <i /> A considered choice
            </div>
            <div className="mock-option selected">
              <CheckMark /> One step closer
            </div>
            <div className="mock-option">
              <i /> Keep moving forward
            </div>
            <div className="paper-bottom">
              <span>● ● ● ○ ○</span>
              <span>Save & Next →</span>
            </div>
          </div>
          <div className="offline-float">
            <ShieldCheck size={23} />
            <div>
              <strong>Offline by design</strong>
              <span>Private. Local. Always yours.</span>
            </div>
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          label="Exams in your library"
          value={exams.length.toString().padStart(2, '0')}
          detail="Ready when you are"
          icon={<BookOpen size={18} />}
        />
        <Stat
          label="Completed attempts"
          value={completed.length.toString().padStart(2, '0')}
          detail="Every session counts"
          icon={<FileJson size={18} />}
        />
        <Stat
          label="Passed / not qualified"
          value={`${passed} / ${completed.length - passed}`}
          detail="Based on your exam criteria"
          icon={<Target size={18} />}
        />
        <Stat
          label="Personal best"
          value={best === null ? '—' : `${round(best)}%`}
          detail={
            best === null ? 'Your first score starts here' : 'Highest percentage across attempts'
          }
          icon={<Trophy size={18} />}
        />
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <div>
              <h2>
                Your examinations <span className="count-tag">{exams.length}</span>
              </h2>
              <p>Pick a paper. Get into examination mode.</p>
            </div>
            <button className="btn text-button" onClick={library}>
              View library <ArrowRight size={15} />
            </button>
          </div>
          {exams.length ? (
            <div className="exam-grid">
              {exams.slice(0, 4).map((e) => (
                <ExamCard key={e.id} record={e} actions={actions} />
              ))}
            </div>
          ) : (
            <div className="import-empty">
              <div className="upload-circle">
                <FolderOpen size={29} />
              </div>
              <h3>Your next attempt starts here</h3>
              <p>
                Import a JSON examination to add your first paper.
                <br />
                Your question banks stay on this device.
              </p>
              <button className="btn btn-outline-primary" onClick={actions.importExam}>
                <Upload size={16} /> Import your first exam
              </button>
              <button className="btn text-button mt-2" onClick={loadExample}>
                Or explore with a demo paper
              </button>
            </div>
          )}
        </section>
        <aside>
          <div className="section-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Your progress, one attempt at a time.</p>
            </div>
          </div>
          <div className="card activity-card">
            {completed.length ? (
              completed
                .sort((a, b) => b.completedAt! - a.completedAt!)
                .slice(0, 4)
                .map((a) => (
                  <button className="activity-row" key={a.id} onClick={() => openAttempt(a)}>
                    <span className={`activity-symbol ${a.result!.passed ? 'passed' : ''}`}>
                      <FileJson size={17} />
                    </span>
                    <span>
                      <strong>{a.exam.examName}</strong>
                      <small>{dateTime(a.completedAt!)}</small>
                    </span>
                    <b>{round(a.result!.percentage)}%</b>
                  </button>
                ))
            ) : (
              <Empty title="A fresh start">
                <p>
                  Complete your first exam to see
                  <br />
                  your performance here.
                </p>
              </Empty>
            )}
            <button className="activity-footer" onClick={scoreboard}>
              Open scoreboard <ArrowRight size={16} />
            </button>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <div>
              <strong>Your practice stays private</strong>
              <p>
                No account. No uploads to a server.
                <br />
                Back up your data to keep it safe.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <div className="profile-strip">
        <span>ONE ENGINE. YOUR EXAM FORMAT.</span>
        {['Railway CBT', 'JEE-style', 'GATE-style', 'NTA-style', 'NCBT & Custom'].map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>
    </>
  );
}
function CheckMark() {
  return <span className="mock-check">✓</span>;
}
export function Library({ exams, actions }: { exams: ExamRecord[]; actions: LibraryActions }) {
  const [search, setSearch] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXAMINATION MANAGEMENT</div>
          <h1>Your exam library</h1>
          <p>Configure your papers. Keep your history.</p>
        </div>
        <button className="btn btn-primary" onClick={actions.importExam}>
          <Plus size={18} /> Import examination
        </button>
      </div>
      <input
        className="form-control mb-4 search-input"
        aria-label="Search library"
        placeholder="Search examinations…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="library-grid">
        {exams
          .filter((e) => e.exam.examName.toLowerCase().includes(search.toLowerCase()))
          .map((e) => (
            <ExamCard key={e.id} record={e} actions={actions} />
          ))}
      </div>
      {!exams.length && (
        <Empty title="An empty library">
          <p>Import an examination to get started.</p>
        </Empty>
      )}
      <p className="local-note mt-4">
        <ShieldCheck size={15} /> Removing a paper never deletes its previous attempts. Use the
        scoreboard to manage history.
      </p>
    </>
  );
}
