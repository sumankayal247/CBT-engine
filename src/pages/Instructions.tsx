import { useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, FileCheck2, ShieldCheck } from 'lucide-react';
import type { ExamRecord } from '../engine/types';
import { maxMarks, questionCount } from '../engine/schema';
import { profiles, resolveProfile } from '../engine/profiles';
import { Legend } from '../components/Common';
export function Instructions({
  record,
  candidate,
  setCandidate,
  onStart,
  onCancel,
}: {
  record: ExamRecord;
  candidate: string;
  setCandidate: (name: string) => void;
  onStart: () => Promise<void>;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    e = record.exam,
    p = resolveProfile(e);
  return (
    <div className="instructions-wrap">
      <button className="btn text-button ps-0 mb-3" onClick={onCancel}>
        <ArrowLeft size={16} /> Back to dashboard
      </button>
      <div className="eyebrow">BEFORE YOU BEGIN</div>
      <h1>Ready. Set. Focus.</h1>
      <p className="text-secondary">
        Please read these instructions carefully. Your timer has not started.
      </p>
      <div className="card instruction-card">
        <div className="instruction-title">
          <div>
            <span className="profile-badge">{profiles[e.examProfile].label}</span>
            <h2>{e.examName}</h2>
          </div>
          <FileCheck2 size={38} />
        </div>
        <div className="instruction-stats">
          <span>
            <strong>{e.durationSeconds / 60} minutes</strong>Overall duration
          </span>
          <span>
            <strong>{questionCount(e)} questions</strong>
            {e.sections.length} sections
          </span>
          <span>
            <strong>{maxMarks(e)} marks</strong>Maximum score
          </span>
        </div>
        <div className="p-4">
          <h3>01 · The examination</h3>
          <ul className="instruction-list">
            <li>
              The countdown starts only when you select <b>Start Examination</b>. It continues if
              you switch tabs or close the browser.
            </li>
            <li>
              The exam submits automatically at the overall deadline. Refreshing does not reset
              time.
            </li>
            <li>
              {e.settings.allowSectionNavigation
                ? 'You may switch between unlocked sections.'
                : 'Sections are sequential. Moving to the next section permanently locks the previous section.'}{' '}
              {p.allowQuestionNavigation
                ? 'You may use the palette to jump to available questions.'
                : 'Direct jumps are restricted; use Previous and Save & Next.'}
            </li>
            <li>
              Previous navigation: {p.allowPrevious ? 'enabled' : 'disabled'}. Review marking:{' '}
              {p.allowReview ? 'enabled' : 'disabled'}. Calculator:{' '}
              {e.settings.allowCalculator ? 'enabled' : 'disabled'}.
            </li>
            <li>
              Section clocks begin on first entry and never reset. Expired sections are locked.{' '}
              {e.settings.sectionExpiry === 'advance'
                ? 'The next section starts at the previous section’s deadline, including while this tab is inactive.'
                : 'The next section starts when you return to the application; the overall deadline still applies.'}
            </li>
          </ul>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Questions</th>
                  <th>Time limit</th>
                  <th>Minimums</th>
                </tr>
              </thead>
              <tbody>
                {e.sections
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.title}
                        {s.settings && (
                          <small className="d-block text-secondary">
                            {Object.entries(s.settings)
                              .map(([k, v]) => `${k}: ${v ? 'yes' : 'no'}`)
                              .join(' · ')}
                          </small>
                        )}
                      </td>
                      <td>{s.questions.length}</td>
                      <td>
                        {s.durationSeconds ? `${s.durationSeconds / 60} min` : 'Overall timer'}
                      </td>
                      <td>
                        {s.minimumMarksToPass !== undefined ? `${s.minimumMarksToPass} marks` : ''}
                        {s.minimumPercentageToPass !== undefined
                          ? ` ${s.minimumPercentageToPass}%`
                          : ''}
                        {s.minimumMarksToPass === undefined &&
                        s.minimumPercentageToPass === undefined
                          ? 'None'
                          : ''}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <h3>02 · Answers & marking</h3>
          <ul className="instruction-list">
            <li>
              Selections are saved immediately. Use <b>Save & Next</b> to proceed, or{' '}
              <b>Clear Response</b> to remove an answer. A review flag is independent of your
              answer; answered review-marked questions are scored.
            </li>
            <li>
              Correct answers receive the question’s marks. Incorrect answers receive that
              question’s negative deduction; unanswered questions receive zero.
            </li>
            <li>
              Question marks range from{' '}
              {Math.min(...e.sections.flatMap((s) => s.questions.map((q) => q.marks)))} to{' '}
              {Math.max(...e.sections.flatMap((s) => s.questions.map((q) => q.marks)))}. Negative
              deductions:{' '}
              {[
                ...new Set(e.sections.flatMap((s) => s.questions.map((q) => q.negativeMarks))),
              ].join(', ')}
              . Each question shows its applicable rules.
            </li>
            <li>
              Multiple-select questions use the explicitly displayed exact-match or partial-credit
              rule. Numerical precision and tolerance are specified per question.
            </li>
            <li>
              To qualify:{' '}
              {e.passCriteria.minimumMarks !== undefined
                ? `at least ${e.passCriteria.minimumMarks} overall marks`
                : ''}
              {e.passCriteria.minimumMarks !== undefined &&
              e.passCriteria.minimumPercentage !== undefined
                ? ' AND '
                : ''}
              {e.passCriteria.minimumPercentage !== undefined
                ? `at least ${e.passCriteria.minimumPercentage}% overall`
                : ''}
              {e.passCriteria.requireAllSectionMinimums
                ? ', AND all configured section minimums'
                : ''}
              . Raw scores determine qualification; display rounding is {e.settings.scorePrecision}{' '}
              decimal places.
            </li>
            <li>
              Answers and explanations{' '}
              {e.settings.showSolutionsAfterSubmit
                ? 'are available after submission'
                : 'will not be revealed after submission'}
              .
            </li>
          </ul>
          <Legend />
          <h3 className="mt-4">03 · Finish with confidence</h3>
          <p>
            Submit Examination opens a summary for confirmation. Use the palette to revisit
            unanswered or review-marked questions where permitted. Keyboard users can Tab between
            controls and use Space / Enter to activate them; arrow keys work in radio groups.
            Optional full-screen mode is for focus, not security.
          </p>
          <div className="alert alert-light border">
            <ShieldCheck size={17} /> Practice simulator only. Your data stays in this browser
            profile. Offline access requires a successful first load and cached assets.
          </div>
          <label className="form-label">
            Candidate name
            <input
              className="form-control"
              maxLength={100}
              value={candidate}
              onChange={(ev) => setCandidate(ev.target.value)}
              placeholder="Practice candidate"
            />
          </label>
          <label className="form-check mt-4">
            <input
              type="checkbox"
              className="form-check-input"
              checked={checked}
              onChange={(ev) => setChecked(ev.target.checked)}
            />
            <span>I have read the instructions and understand the examination rules.</span>
          </label>
          {error && (
            <p role="alert" className="text-danger mt-3">
              {error}
            </p>
          )}
        </div>
        <div className="instruction-footer">
          <span>
            <Clock3 size={16} /> Your timer starts on the next click
          </span>
          <button
            disabled={!checked || busy}
            className="btn btn-primary"
            onClick={async () => {
              setBusy(true);
              try {
                await onStart();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not start examination.');
                setBusy(false);
              }
            }}
          >
            {busy ? 'Starting…' : 'Start Examination'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
