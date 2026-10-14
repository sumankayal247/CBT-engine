import { useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator as CalculatorIcon,
  Check,
  ChevronDown,
  Clock3,
  Eraser,
  Flag,
  Maximize,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Attempt } from '../engine/types';
import {
  advanceTime,
  canNavigate,
  finalize,
  navigate,
  nextSection,
  questionStatus,
  remaining,
  sectionDeadline,
  sectionPosition,
  setResponse,
} from '../engine/attempt';
import { resolveProfile } from '../engine/profiles';
import { clock, hasAnswer, numericValid } from '../engine/scoring';
import { Legend, Modal, RichText, statusLabels } from '../components/Common';
import { Calculator } from '../components/Calculator';
type Update = (change: (a: Attempt) => Attempt) => void;
export function LiveExam({
  attempt: a,
  update,
  saveState,
  onRetry,
}: {
  attempt: Attempt;
  update: Update;
  saveState: string;
  onRetry: () => void;
}) {
  const [submit, setSubmit] = useState(false),
    [calculator, setCalculator] = useState(false),
    [notice, setNotice] = useState(''),
    [palette, setPalette] = useState(false),
    [invalid, setInvalid] = useState(false),
    [clearKey, setClearKey] = useState(0);
  const e = a.exam,
    s = e.sections[a.currentSection],
    q = s.questions[a.currentQuestion],
    p = resolveProfile(e, s),
    r = a.responses[q.id],
    total = e.sections.flatMap((s) => s.questions),
    answered = total.filter((q) => hasAnswer(a.responses[q.id]?.answer)).length,
    review = total.filter((q) => a.responses[q.id]?.review).length;
  const left = remaining(a.deadline),
    warning = e.settings.warningSeconds.some((t) => left <= t),
    number =
      e.sections.slice(0, a.currentSection).reduce((n, s) => n + s.questions.length, 0) +
      a.currentQuestion +
      1;
  function moveNext(mark = false) {
    update((current) => {
      let next = mark ? setResponse(current, { review: true }) : advanceTime(current);
      if (next.status !== 'active' || next.currentSection !== current.currentSection) return next;
      if (next.currentQuestion < next.exam.sections[next.currentSection].questions.length - 1)
        next = navigate(next, next.currentSection, next.currentQuestion + 1);
      return next;
    });
  }
  function jump(si: number, qi: number) {
    setNotice('');
    setPalette(false);
    update((v) => navigate(v, si, qi));
  }
  async function fullscreen() {
    try {
      if (!document.fullscreenEnabled) {
        setNotice('Full-screen mode is not available in this browser or preview.');
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('Full-screen permission was not granted. You can continue normally.');
    }
  }
  const currentStatus = questionStatus(r);
  return (
    <div className="exam-shell" style={{ '--exam-accent': p.accent } as CSSProperties}>
      <header className="exam-header">
        <div className="exam-brand">
          <span className="brand-mark small">E</span>
          <div>
            <h1>{e.examName}</h1>
            <span>{p.label} · Practice examination</span>
          </div>
        </div>
        <div className="exam-header-tools">
          <button
            className="btn exam-tool"
            title="Toggle full screen"
            aria-label="Toggle full screen"
            onClick={() => void fullscreen()}
          >
            <Maximize size={19} />
          </button>
          {e.settings.allowCalculator && (
            <button className="btn exam-tool" onClick={() => setCalculator(true)}>
              <CalculatorIcon size={18} />
              <span className="d-none d-sm-inline">Calculator</span>
            </button>
          )}
          <div
            className={`main-timer ${warning ? 'timer-warning' : ''}`}
            role="timer"
            aria-label={`Time remaining ${clock(left)}`}
          >
            <Clock3 size={22} />
            <span>
              <small>TIME REMAINING</small>
              <strong>{clock(left)}</strong>
            </span>
          </div>
        </div>
      </header>
      <div className="exam-subheader">
        <span>
          <ShieldCheck size={14} /> Practice mode · Not an official examination
        </span>
        <span className={saveState === 'error' ? 'text-danger' : ''}>
          {saveState === 'saved' ? (
            <>
              <Check size={14} /> Saved to this device
            </>
          ) : saveState === 'saving' ? (
            'Saving…'
          ) : (
            <button className="btn text-button text-danger p-0" onClick={onRetry}>
              Save failed · retry now
            </button>
          )}
        </span>
      </div>
      {notice && (
        <div className="alert alert-info m-2" role="status">
          {notice}
          <button className="btn text-button" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}
      <div className="exam-section-tabs">
        <span className="section-caption">SECTIONS</span>
        {e.sections.map((section, i) => (
          <button
            key={section.id}
            className={i === a.currentSection ? 'active' : ''}
            disabled={invalid || !canNavigate(a, i, sectionPosition(a, i))}
            onClick={() => jump(i, sectionPosition(a, i))}
          >
            {section.title}
            {a.lockedSections.includes(section.id) && ' · Locked'}
          </button>
        ))}
        <button className="mobile-palette-toggle" onClick={() => setPalette(!palette)}>
          Question palette <ChevronDown size={15} />
        </button>
      </div>
      <div className={`exam-workspace palette-${p.palettePosition}`}>
        <main className="question-workspace">
          <div className="question-topline">
            <div>
              <span className="eyebrow">{s.title}</span>
              <h2>
                Question {number} <span>of {total.length}</span>
              </h2>
            </div>
            <div className="question-marking">
              <span className="positive-mark">+{q.marks}</span>
              <span className="negative-mark">−{q.negativeMarks}</span>
              <span>
                {q.type === 'single-choice'
                  ? 'Single choice'
                  : q.type === 'multiple-select'
                    ? 'Multiple select'
                    : 'Numerical answer'}
              </span>
            </div>
          </div>
          <div className="question-content" lang={e.language}>
            <div className="question-prompt">
              <RichText text={q.questionText} />
            </div>
            {q.image && <img className="question-image" src={q.image.src} alt={q.image.alt} />}
            <p className="answer-hint">
              {q.type === 'single-choice'
                ? 'Select one correct answer.'
                : q.type === 'multiple-select'
                  ? 'Select all options that apply.'
                  : 'Enter your numerical response.'}
            </p>
            {q.type !== 'numerical' ? (
              <fieldset className={`answer-options ${p.compactOptions ? 'compact-options' : ''}`}>
                <legend className="visually-hidden">Answer options</legend>
                {q.options.map((o, i) => {
                  const selected = Array.isArray(r?.answer) && r.answer.includes(o.id);
                  return (
                    <label className={`answer-option ${selected ? 'selected' : ''}`} key={o.id}>
                      <input
                        type={q.type === 'single-choice' ? 'radio' : 'checkbox'}
                        name={q.id}
                        checked={selected}
                        onChange={() =>
                          update((v) => {
                            const old = v.responses[q.id]?.answer;
                            const list = Array.isArray(old) ? old : [];
                            return setResponse(v, {
                              answer:
                                q.type === 'single-choice'
                                  ? [o.id]
                                  : list.includes(o.id)
                                    ? list.filter((id) => id !== o.id)
                                    : [...list, o.id],
                            });
                          })
                        }
                      />
                      <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                      <RichText text={o.text} />
                      {selected && <Check className="option-check" size={17} />}
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <NumericAnswer
                key={`${q.id}-${clearKey}`}
                initial={typeof r?.answer === 'string' ? r.answer : ''}
                precision={q.decimalPrecision}
                onChange={(value) => update((v) => setResponse(v, { answer: value }))}
                onValidity={(valid) => setInvalid(!valid)}
              />
            )}
            {q.type === 'multiple-select' && (
              <div className="scoring-note">
                {q.scoring.mode === 'exact'
                  ? 'Exact match: all correct options and no incorrect options are required for credit.'
                  : `Partial credit: +${q.scoring.perCorrectOption} per correct selection, −${q.scoring.incorrectSelectionPenalty} per incorrect selection. Score bounded from −${q.negativeMarks} to +${q.marks}.`}
              </div>
            )}
            {q.type === 'numerical' && (
              <div className="scoring-note">
                {q.decimalPrecision !== undefined
                  ? `Up to ${q.decimalPrecision} decimal places. `
                  : ''}
                Tolerance: absolute {q.absoluteTolerance ?? 0}, relative{' '}
                {(q.relativeTolerance ?? 0) * 100}%. No units or scientific notation.
              </div>
            )}
          </div>
          <div className="response-indicator">
            <span className={`status-dot ${currentStatus}`} />
            {statusLabels[currentStatus]}
            {r?.review && (
              <button
                disabled={invalid}
                className="btn text-button"
                onClick={() => update((v) => setResponse(v, { review: false }))}
              >
                Remove review flag
              </button>
            )}
            <span className="ms-auto small text-secondary">Responses save automatically</span>
          </div>
          <div className="question-controls">
            <div>
              {p.allowPrevious && (
                <button
                  className="btn btn-outline-secondary"
                  disabled={invalid || a.currentQuestion === 0}
                  onClick={() => jump(a.currentSection, a.currentQuestion - 1)}
                >
                  <ArrowLeft size={16} /> Previous
                </button>
              )}
              <button
                className="btn btn-light"
                onClick={() => {
                  setInvalid(false);
                  setClearKey((n) => n + 1);
                  update((v) => setResponse(v, { answer: q.type === 'numerical' ? '' : [] }));
                }}
              >
                <Eraser size={16} /> Clear Response
              </button>
            </div>
            <div>
              {p.allowReview && (
                <button
                  disabled={invalid}
                  className="btn btn-review"
                  onClick={() => moveNext(true)}
                >
                  <Flag size={15} /> Mark for Review & Next
                </button>
              )}
              <button
                disabled={invalid}
                className="btn btn-exam-primary"
                onClick={() => {
                  moveNext();
                  if (a.currentQuestion === s.questions.length - 1)
                    setNotice(
                      'Last question of this section. Review your responses, continue to the next section or submit.',
                    );
                }}
              >
                Save & Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
          {a.currentSection < e.sections.length - 1 && (
            <div className="next-section">
              <button
                disabled={invalid}
                className="btn text-button"
                onClick={() => {
                  if (
                    e.settings.allowSectionNavigation ||
                    window.confirm(
                      'Continue to the next section? This section will be permanently locked.',
                    )
                  )
                    update((v) => nextSection(v));
                }}
              >
                Continue to next section <ArrowRight size={15} />
              </button>
            </div>
          )}
          <button
            className="btn btn-exam-primary mobile-submit"
            disabled={invalid}
            onClick={() => setSubmit(true)}
          >
            Review & submit <ArrowRight size={16} />
          </button>
        </main>
        <aside className={`question-sidebar ${palette ? 'show-palette' : ''}`}>
          {p.showCandidate && (
            <div className="candidate-panel">
              <span className="candidate-avatar">
                <UserRound size={25} />
              </span>
              <div>
                <small>CANDIDATE</small>
                <strong>{a.candidate}</strong>
                <span>{e.examCode || p.short} · Practice</span>
              </div>
            </div>
          )}
          <div className="palette-section">
            <div className="d-flex justify-content-between align-items-center">
              <h3>Question palette</h3>
              <span>
                {answered}/{total.length}
              </span>
            </div>
            <p>{s.title}</p>
            {s.durationSeconds && (
              <div className="section-timer">
                <Clock3 size={15} /> Section remaining{' '}
                <b>{clock(remaining(sectionDeadline(a, a.currentSection)))}</b>
              </div>
            )}
            <div className="question-palette">
              {s.questions.map((question, i) => {
                const state = questionStatus(
                  a.responses[question.id],
                  a.lockedSections.includes(s.id),
                );
                return (
                  <button
                    key={question.id}
                    aria-label={`Question ${i + 1}: ${statusLabels[state]}`}
                    aria-current={i === a.currentQuestion ? 'step' : undefined}
                    className={`palette-button ${state} ${i === a.currentQuestion ? 'current' : ''}`}
                    disabled={invalid || !canNavigate(a, a.currentSection, i)}
                    onClick={() => jump(a.currentSection, i)}
                  >
                    {i + 1}
                    {state === 'answered-review' && <span className="review-check">✓</span>}
                  </button>
                );
              })}
            </div>
            <Legend />
          </div>
          <div className="exam-progress">
            <div>
              <span>Answered</span>
              <strong>
                {answered} of {total.length}
              </strong>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Questions answered"
              aria-valuenow={answered}
              aria-valuemin={0}
              aria-valuemax={total.length}
            >
              <div
                className="progress-bar"
                style={{ width: `${(answered / total.length) * 100}%` }}
              />
            </div>
            <p>{total.length - answered} questions without a response</p>
          </div>
          <div className="submit-panel">
            <button
              className="btn btn-outline-primary w-100"
              disabled={invalid}
              onClick={() => setSubmit(true)}
            >
              Submit Examination <ArrowRight size={16} />
            </button>
            <small>You will review a summary before submitting.</small>
          </div>
        </aside>
      </div>
      <footer className="exam-footer">
        <span>
          ExamDesk <span className="text-secondary">/ CBT Practice Engine</span>
        </span>
        <span>Local persistence · Deadline-protected session</span>
      </footer>
      {calculator && <Calculator onClose={() => setCalculator(false)} />}
      {submit && (
        <Modal
          title="Submit your examination?"
          onClose={() => setSubmit(false)}
          footer={
            <>
              <button className="btn btn-outline-secondary" onClick={() => setSubmit(false)}>
                Return to examination
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSubmit(false);
                  update((v) => finalize(advanceTime(v), 'manual'));
                }}
              >
                Confirm submission
              </button>
            </>
          }
        >
          <p>Your responses will be finalized. You cannot edit this attempt after submission.</p>
          <div className="submission-summary">
            <div>
              <strong>{answered}</strong>Answered
            </div>
            <div>
              <strong>{total.length - answered}</strong>Unanswered
            </div>
            <div>
              <strong>{review}</strong>Marked for review
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Answered</th>
                  <th>Unanswered</th>
                </tr>
              </thead>
              <tbody>
                {e.sections.map((section) => {
                  const n = section.questions.filter((q) =>
                    hasAnswer(a.responses[q.id]?.answer),
                  ).length;
                  return (
                    <tr key={section.id}>
                      <td>{section.title}</td>
                      <td>{n}</td>
                      <td>{section.questions.length - n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small text-secondary">
            Answered questions marked for review are included in scoring. The timer continues while
            this dialog is open.
          </p>
        </Modal>
      )}
    </div>
  );
}
function NumericAnswer({
  initial,
  precision,
  onChange,
  onValidity,
}: {
  initial: string;
  precision?: number;
  onChange: (s: string) => void;
  onValidity: (valid: boolean) => void;
}) {
  const [value, setValue] = useState(initial),
    valid = value === '' || numericValid(value, precision);
  return (
    <div className="numerical-answer">
      <label className="form-label">
        Numerical response
        <input
          className={`form-control ${valid ? '' : 'is-invalid'}`}
          type="text"
          inputMode="decimal"
          value={value}
          maxLength={100}
          aria-invalid={!valid}
          aria-describedby="numeric-help"
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            const ok = v === '' || numericValid(v, precision);
            onValidity(ok);
            if (ok) onChange(v);
          }}
        />
      </label>
      <p id="numeric-help" className={valid ? 'text-secondary small' : 'text-danger small'}>
        {valid
          ? 'Your valid numeric entry is saved automatically.'
          : `Enter a valid number${precision !== undefined ? ` with at most ${precision} decimal places` : ''}, or clear it to continue. This incomplete entry is not saved.`}
      </p>
    </div>
  );
}
