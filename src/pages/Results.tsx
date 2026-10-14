import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  RotateCcw,
  Target,
  Trophy,
} from 'lucide-react';
import type { Attempt, Answer } from '../engine/types';
import { profiles } from '../engine/profiles';
import { round } from '../engine/scoring';
import { dateTime, RichText, Stat } from '../components/Common';
import { download } from '../engine/storage';
import type { Question } from '../engine/schema';
function answerText(q: Question, a: Answer | undefined) {
  if (!a || (Array.isArray(a) && !a.length) || a === '') return 'No response';
  if (q.type === 'numerical') return String(a);
  return Array.isArray(a)
    ? a.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(' · ')
    : String(a);
}
export function Results({
  attempt: a,
  onHome,
  onScoreboard,
  onRetry,
}: {
  attempt: Attempt;
  onHome: () => void;
  onScoreboard: () => void;
  onRetry: () => void;
}) {
  const [review, setReview] = useState(false),
    [filter, setFilter] = useState('all'),
    r = a.result!,
    precision = a.exam.settings.scorePrecision,
    f = (n: number) => round(n, precision),
    reveal = a.exam.settings.showSolutionsAfterSubmit;
  return (
    <>
      <button className="btn text-button ps-0 mb-3" onClick={onHome}>
        <ArrowLeft size={16} /> Back to dashboard
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXAMINATION COMPLETE</div>
          <h1>Your effort, in perspective.</h1>
          <p>
            {a.exam.examName} · {profiles[a.exam.examProfile].label}
          </p>
        </div>
        <button
          className="btn btn-outline-secondary"
          onClick={() => download(`attempt-${a.id}.json`, a)}
        >
          <ArrowDownToLine size={17} /> Export attempt
        </button>
      </div>
      <section className={`result-hero ${r.passed ? '' : 'not-passed'}`}>
        <div className="result-medal">
          <Trophy size={38} />
        </div>
        <div>
          <span className="result-status">
            {r.passed ? 'PASS · QUALIFIED' : 'FAIL · NOT QUALIFIED'}
          </span>
          <h2>
            {r.passed ? 'A milestone worth building on.' : 'Every attempt is a step forward.'}
          </h2>
          <p>
            {a.candidate} · Completed {dateTime(a.completedAt!)}
            <br />
            {a.reason === 'manual'
              ? 'Submitted by candidate'
              : a.reason === 'timeout'
                ? 'Automatically submitted at the overall deadline'
                : 'Automatically submitted when all sections locked'}
          </p>
        </div>
        <div className="result-score">
          <strong>
            {f(r.marks)}
            <span> / {r.maximum}</span>
          </strong>
          <span>{f(r.percentage)}% overall score</span>
        </div>
      </section>
      <div className="stats-grid mt-4">
        <Stat
          label="Correct answers"
          value={r.correct}
          detail={`${r.partial} partially correct`}
          icon={<Check size={18} />}
        />
        <Stat
          label="Accuracy"
          value={`${f(r.accuracy)}%`}
          detail="Fully correct ÷ attempted"
          icon={<Target size={18} />}
        />
        <Stat
          label="Time taken"
          value={<span className="time-stat">{r.timeTaken}</span>}
          detail={`Of ${a.exam.durationSeconds / 60} configured minutes`}
          icon={<Clock3 size={18} />}
        />
        <Stat
          label="Marked for review"
          value={r.review}
          detail="Review flags do not change scoring"
          icon={<Flag size={18} />}
        />
      </div>
      <div className="result-breakdown card p-4">
        <div className="section-heading">
          <div>
            <h2>Section-wise performance</h2>
            <p>Calculated from your finalized responses and original exam snapshot.</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Marks</th>
                <th>Percentage</th>
                <th>Correct</th>
                <th>Partial</th>
                <th>Incorrect</th>
                <th>Unanswered</th>
                <th>Section threshold</th>
              </tr>
            </thead>
            <tbody>
              {r.sections.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>
                    <b>{f(s.marks)}</b> / {s.maximum}
                  </td>
                  <td>{f(s.percentage)}%</td>
                  <td>{s.correct}</td>
                  <td>{s.partial}</td>
                  <td>{s.incorrect}</td>
                  <td>{s.unanswered}</td>
                  <td>
                    {s.hasThreshold ? (
                      <span className={`result-pill ${s.qualified ? 'pass' : 'fail'}`}>
                        {s.qualified ? 'Met' : 'Not met'}
                      </span>
                    ) : (
                      'Not configured'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="result-totals">
          <span>
            <b>{r.attempted}</b> attempted
          </span>
          <span>
            <b>{r.incorrect}</b> incorrect
          </span>
          <span>
            <b>{r.unanswered}</b> unanswered
          </span>
          <span>
            <b>{f(r.negativeMarks)}</b> negative marks deducted
          </span>
        </div>
        <p className="small text-secondary mt-3 mb-0">
          Overall criteria:{' '}
          {a.exam.passCriteria.minimumMarks !== undefined
            ? `minimum ${a.exam.passCriteria.minimumMarks} marks`
            : ''}
          {a.exam.passCriteria.minimumPercentage !== undefined
            ? ` minimum ${a.exam.passCriteria.minimumPercentage}%`
            : ''}
          . Section minimums{' '}
          {a.exam.passCriteria.requireAllSectionMinimums ? 'are required' : 'are not required'} for
          overall qualification. Completion date and elapsed time are recorded separately. This is a
          practice result, not an official result.
        </p>
      </div>
      <div className="d-flex flex-wrap gap-3 my-4">
        <button className="btn btn-primary" onClick={onRetry}>
          <RotateCcw size={16} /> Start another attempt
        </button>
        <button className="btn btn-outline-secondary" onClick={onScoreboard}>
          Open scoreboard <ArrowRight size={16} />
        </button>
        {reveal && (
          <button className="btn btn-outline-secondary" onClick={() => setReview(!review)}>
            {review ? 'Hide' : 'Review'} answers
          </button>
        )}
      </div>
      {!reveal && (
        <div className="alert alert-light border">
          Answer review is disabled by this examination’s reveal policy. Local exports contain the
          full original snapshot for backup; this offline simulator is not a secure proctoring
          system.
        </div>
      )}
      {review && reveal && (
        <section className="card p-4">
          <div className="section-heading">
            <h2>Answer-by-answer review</h2>
            <select
              className="form-select w-auto"
              aria-label="Filter answer review"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {['all', 'correct', 'partial', 'incorrect', 'unanswered'].map((v) => (
                <option key={v} value={v}>
                  {v === 'all' ? 'All questions' : v}
                </option>
              ))}
            </select>
          </div>
          {a.exam.sections
            .flatMap((s) => s.questions.map((q) => ({ q, s })))
            .filter(
              ({ q }) =>
                filter === 'all' || r.questions.find((row) => row.id === q.id)?.outcome === filter,
            )
            .map(({ q, s }) => {
              const row = r.questions.find((row) => row.id === q.id)!;
              return (
                <article className="answer-review" key={q.id}>
                  <div className="d-flex justify-content-between mb-3">
                    <span className="eyebrow">
                      {s.title} · {q.id}
                    </span>
                    <span
                      className={`result-pill ${row.outcome === 'correct' ? 'pass' : row.outcome === 'incorrect' ? 'fail' : 'neutral'}`}
                    >
                      {row.outcome} · {f(row.marks)} marks
                    </span>
                  </div>
                  <h3>
                    <RichText text={q.questionText} />
                  </h3>
                  {q.image && (
                    <img className="question-image" src={q.image.src} alt={q.image.alt} />
                  )}
                  <p>
                    <b>Your response:</b>{' '}
                    <RichText text={answerText(q, a.responses[q.id]?.answer)} />
                  </p>
                  <p>
                    <b>Correct answer:</b>{' '}
                    <RichText
                      text={
                        q.type === 'numerical'
                          ? String(q.correctAnswer)
                          : answerText(q, q.correctOptionIds)
                      }
                    />
                  </p>
                  {q.explanation && (
                    <div className="explanation">
                      <strong>Explanation</strong>
                      <p className="mb-0 mt-2">
                        <RichText text={q.explanation} />
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
        </section>
      )}
    </>
  );
}
