import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileJson,
  Upload,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { maxMarks, parseExam, profileNames, questionCount, type Exam } from '../engine/schema';
import { profiles } from '../engine/profiles';
import type { ExamRecord } from '../engine/types';
import { RichText } from '../components/Common';
export function ImportExam({
  existing,
  onSave,
  onCancel,
}: {
  existing?: ExamRecord;
  onSave: (exam: Exam, existing?: ExamRecord) => Promise<void>;
  onCancel: () => void;
}) {
  const [source, setSource] = useState(existing ? JSON.stringify(existing.exam, null, 2) : ''),
    [fileName, setFileName] = useState(existing ? 'Saved configuration' : ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    validation = useMemo(() => (source ? parseExam(source) : undefined), [source]);
  const raw = useMemo(() => {
    try {
      const v: unknown = JSON.parse(source);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }, [source]);
  const settings = (
    raw?.settings && typeof raw.settings === 'object' ? raw.settings : {}
  ) as Record<string, unknown>;
  const pass = (
    raw?.passCriteria && typeof raw.passCriteria === 'object' ? raw.passCriteria : {}
  ) as Record<string, unknown>;
  const presentation = (
    settings.presentation && typeof settings.presentation === 'object' ? settings.presentation : {}
  ) as Record<string, unknown>;
  function patch(field: string, value: unknown) {
    if (raw) setSource(JSON.stringify({ ...raw, [field]: value }, null, 2));
  }
  function setting(field: string, value: unknown) {
    patch('settings', { ...settings, [field]: value });
  }
  async function read(file?: File) {
    if (!file) return;
    setError('');
    if (file.size > 10_000_000) {
      setError('File exceeds the 10 MB import limit.');
      return;
    }
    try {
      setSource(await file.text());
      setFileName(file.name);
    } catch {
      setError('This file could not be read. Try again.');
    }
  }
  const exam = validation?.exam;
  return (
    <>
      <button className="btn text-button mb-3 ps-0" onClick={onCancel}>
        <ArrowLeft size={16} /> Back to library
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {existing ? 'EXAM CONFIGURATION' : 'BRING YOUR OWN QUESTION BANK'}
          </div>
          <h1>{existing ? 'Inspect & configure' : 'Import an examination'}</h1>
          <p>A validated paper, ready for a real examination workflow.</p>
        </div>
        <a
          href={`${import.meta.env.BASE_URL}FORMAT.md`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline-secondary"
        >
          JSON format guide <ArrowRight size={15} />
        </a>
      </div>
      <div className="import-columns">
        <section>
          <div className="card p-4">
            <h2 className="step-title">
              <span>01</span> {existing ? 'Replace or edit configuration' : 'Choose your JSON file'}
            </h2>
            <div
              className="dropzone"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                void read(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={32} />
              <h3>{fileName || 'Drop your examination here'}</h3>
              <p>Version 1.0 JSON · up to 10 MB</p>
              <button className="btn btn-primary" onClick={() => input.current?.click()}>
                Browse files
              </button>
              <input
                ref={input}
                hidden
                type="file"
                accept=".json,application/json"
                aria-label="Exam JSON file"
                onChange={(e) => void read(e.target.files?.[0])}
              />
            </div>
            <div className="d-flex justify-content-between flex-wrap gap-2 mt-3">
              <a
                href={`${import.meta.env.BASE_URL}examples/demo-engineering.json`}
                download
                className="small-link"
              >
                <ArrowDownToLine size={15} /> Download example
              </a>
              <button className="btn text-button p-0" onClick={() => setEditor(!editor)}>
                {editor ? 'Hide JSON editor' : 'Paste or edit JSON'}
              </button>
            </div>
            {editor && (
              <label className="form-label d-block mt-3">
                Examination JSON
                <textarea
                  className="form-control json-editor mt-2"
                  aria-label="Examination JSON"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  rows={16}
                  spellCheck={false}
                />
              </label>
            )}
          </div>
          {raw && (
            <div className="card p-4 mt-4">
              <h2 className="step-title">
                <span>02</span> Configure your session
              </h2>
              <p className="text-secondary small">
                These settings are saved into the examination. No code changes needed.
              </p>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">
                    Examination name
                    <input
                      className="form-control"
                      value={String(raw.examName ?? '')}
                      onChange={(e) => patch('examName', e.target.value)}
                    />
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Exam profile
                    <select
                      className="form-select"
                      value={String(raw.examProfile ?? 'generic')}
                      onChange={(e) => patch('examProfile', e.target.value)}
                    >
                      {profileNames.map((p) => (
                        <option key={p} value={p}>
                          {profiles[p].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Duration (seconds)
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={Number(raw.durationSeconds) || ''}
                      onChange={(e) =>
                        patch(
                          'durationSeconds',
                          e.target.value === '' ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Overall minimum marks
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-control"
                      placeholder="Required if no percentage"
                      value={pass.minimumMarks === undefined ? '' : Number(pass.minimumMarks)}
                      onChange={(e) =>
                        patch('passCriteria', {
                          ...pass,
                          minimumMarks: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Overall minimum percentage
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      className="form-control"
                      placeholder="Optional with minimum marks"
                      value={
                        pass.minimumPercentage === undefined ? '' : Number(pass.minimumPercentage)
                      }
                      onChange={(e) =>
                        patch('passCriteria', {
                          ...pass,
                          minimumPercentage:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Timed-section expiry
                    <select
                      className="form-select"
                      value={String(settings.sectionExpiry ?? '')}
                      onChange={(e) => setting('sectionExpiry', e.target.value || undefined)}
                    >
                      <option value="">Choose for timed sections</option>
                      <option value="advance">Lock & advance at deadline</option>
                      <option value="lock">Lock & open next at return</option>
                    </select>
                  </label>
                </div>
                <div className="col-sm-6">
                  <label className="form-label">
                    Score decimal places
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      max="8"
                      value={Number(settings.scorePrecision ?? 2)}
                      onChange={(e) => setting('scorePrecision', Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
              <label className="form-check mt-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!pass.requireAllSectionMinimums}
                  onChange={(e) =>
                    patch('passCriteria', { ...pass, requireAllSectionMinimums: e.target.checked })
                  }
                />
                <span>Require all configured section minimums</span>
              </label>
              <hr />
              <div className="settings-checks">
                {[
                  ['allowSectionNavigation', 'Free section navigation', true],
                  ['allowQuestionNavigation', 'Direct question navigation', true],
                  ['allowPrevious', 'Previous question navigation', true],
                  ['allowReview', 'Mark for review', true],
                  ['shuffleQuestions', 'Shuffle questions', false],
                  ['shuffleOptions', 'Shuffle options', false],
                  ['allowCalculator', 'Virtual calculator', false],
                  ['showSolutionsAfterSubmit', 'Reveal answers after submission', true],
                ].map(([field, label, fallback]) => (
                  <label key={String(field)} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(settings[String(field)] ?? fallback)}
                      onChange={(e) => setting(String(field), e.target.checked)}
                    />
                    <span>{String(label)}</span>
                  </label>
                ))}
              </div>
              <details className="mt-4">
                <summary>
                  <Settings2 size={15} /> Layout overrides & section settings
                </summary>
                <div className="row g-3 mt-1">
                  <div className="col-sm-6">
                    <label className="form-label">
                      Palette position
                      <select
                        className="form-select"
                        value={String(presentation.palettePosition ?? '')}
                        onChange={(e) =>
                          setting('presentation', {
                            ...presentation,
                            palettePosition: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Profile default</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">
                      Accent colour
                      <input
                        className="form-control form-control-color"
                        type="color"
                        value={String(presentation.accent ?? '#21645d')}
                        onChange={(e) =>
                          setting('presentation', { ...presentation, accent: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="col-12">
                    <label className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={presentation.showCandidate !== false}
                        onChange={(e) =>
                          setting('presentation', {
                            ...presentation,
                            showCandidate: e.target.checked,
                          })
                        }
                      />
                      Show candidate panel
                    </label>
                  </div>
                </div>
                <label className="form-check mt-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={presentation.compactOptions === true}
                    onChange={(e) =>
                      setting('presentation', { ...presentation, compactOptions: e.target.checked })
                    }
                  />
                  Compact answer options
                </label>
                <SectionSettings
                  sections={raw.sections}
                  onChange={(sections) => patch('sections', sections)}
                />
                <p className="small text-secondary mt-3">
                  Question scoring and content are editable in the JSON editor above. Revalidation
                  happens as you type.
                </p>
              </details>
            </div>
          )}
        </section>
        <aside>
          <div className="card p-4 validation-panel">
            <h2 className="step-title">
              <span>03</span> Validate & preview
            </h2>
            {!validation ? (
              <div className="preview-placeholder">
                <FileJson size={42} />
                <p>
                  Your examination preview
                  <br />
                  will appear here.
                </p>
              </div>
            ) : (
              <>
                {validation.errors.length > 0 && (
                  <div className="alert alert-danger">
                    <strong>
                      <AlertTriangle size={17} /> {validation.errors.length} issues to resolve
                    </strong>
                    <ul className="validation-list">
                      {validation.errors.map((i, n) => (
                        <li key={n}>
                          <code>{i.path}</code>
                          <br />
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="alert alert-warning">
                    <strong>Configuration notes</strong>
                    <ul className="validation-list">
                      {validation.warnings.map((i, n) => (
                        <li key={n}>
                          <code>{i.path}</code>: {i.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exam && (
                  <>
                    <div className="valid-note">
                      <CheckCircle2 size={18} /> Configuration is valid
                    </div>
                    <h3 className="mt-4">{exam.examName}</h3>
                    <span className="profile-badge">{profiles[exam.examProfile].label}</span>
                    <div className="preview-stats">
                      <span>
                        <strong>{questionCount(exam)}</strong>questions
                      </span>
                      <span>
                        <strong>{maxMarks(exam)}</strong>marks
                      </span>
                      <span>
                        <strong>{exam.durationSeconds / 60}</strong>minutes
                      </span>
                    </div>
                    {exam.sections.map((s) => (
                      <div className="section-preview" key={s.id}>
                        <h4>{s.title}</h4>
                        <small>
                          {s.questions.length} questions ·{' '}
                          {s.questions.reduce((n, q) => n + q.marks, 0)} marks
                          {s.durationSeconds ? ` · ${s.durationSeconds / 60} min` : ''}
                        </small>
                        <p>
                          <RichText text={s.questions[0].questionText} />
                        </p>
                      </div>
                    ))}
                    <p className="small text-secondary">
                      {existing
                        ? 'Replacing this configuration keeps all historical attempt snapshots unchanged.'
                        : 'A unique library record is created. Existing papers and attempts are not overwritten.'}
                    </p>
                    <button
                      className="btn btn-primary w-100"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          await onSave(exam, existing);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Unable to save examination.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? 'Saving…' : existing ? 'Save configuration' : 'Save to exam library'}{' '}
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </>
            )}
            {error && (
              <div className="alert alert-danger mt-3" role="alert">
                {error}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function SectionSettings({
  sections,
  onChange,
}: {
  sections: unknown;
  onChange: (sections: unknown[]) => void;
}) {
  if (!Array.isArray(sections)) return null;
  return (
    <div className="mt-4">
      {sections.map((value: unknown, i) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const s = value as Record<string, unknown>,
          settings = (s.settings && typeof s.settings === 'object' ? s.settings : {}) as Record<
            string,
            unknown
          >;
        const change = (field: string, value: unknown) =>
          onChange(sections.map((section, j) => (i === j ? { ...s, [field]: value } : section)));
        return (
          <fieldset className="border rounded p-3 mb-3" key={i}>
            <legend className="float-none w-auto px-2 fs-6">
              {String(s.title ?? `Section ${i + 1}`)}
            </legend>
            <div className="row g-3">
              {[
                ['durationSeconds', 'Section duration (seconds)'],
                ['minimumMarksToPass', 'Section minimum marks'],
                ['minimumPercentageToPass', 'Section minimum percentage'],
              ].map(([field, label]) => (
                <div className="col-sm-6" key={field}>
                  <label className="form-label">
                    {label}
                    <input
                      className="form-control"
                      type="number"
                      step={field === 'durationSeconds' ? '1' : 'any'}
                      min={field === 'durationSeconds' ? 1 : 0}
                      placeholder="Not configured"
                      value={s[field] === undefined ? '' : Number(s[field])}
                      onChange={(e) =>
                        change(field, e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="row g-2 mt-2">
              {[
                ['allowQuestionNavigation', 'Direct jumps'],
                ['allowPrevious', 'Previous'],
                ['allowReview', 'Review marking'],
              ].map(([field, label]) => (
                <div className="col-sm-4" key={field}>
                  <label className="form-label">
                    {label}
                    <select
                      className="form-select"
                      value={settings[field] === undefined ? '' : String(settings[field])}
                      onChange={(e) =>
                        change('settings', {
                          ...settings,
                          [field]: e.target.value === '' ? undefined : e.target.value === 'true',
                        })
                      }
                    >
                      <option value="">Inherit</option>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
