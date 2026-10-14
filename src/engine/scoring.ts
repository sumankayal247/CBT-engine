import type { Exam, Question } from './schema';
import type { Answer, Attempt, Result, QuestionResult } from './types';
export function hasAnswer(answer: Answer | undefined) {
  return Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer.trim() !== '';
}
export function numericValid(value: string, precision?: number) {
  return (
    /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) &&
    Number.isFinite(Number(value)) &&
    (precision === undefined || (value.split('.')[1]?.length ?? 0) <= precision)
  );
}
export function scoreQuestion(
  q: Question,
  answer: Answer | undefined,
): Pick<QuestionResult, 'marks' | 'outcome'> {
  if (!hasAnswer(answer)) return { marks: 0, outcome: 'unanswered' };
  if (q.type === 'numerical') {
    const n =
      typeof answer === 'string' && numericValid(answer, q.decimalPrecision) ? Number(answer) : NaN;
    const tol = Math.max(
      q.absoluteTolerance ?? 0,
      Math.abs(q.correctAnswer) * (q.relativeTolerance ?? 0),
    );
    const correct =
      Number.isFinite(n) &&
      Math.abs(n - q.correctAnswer) <=
        tol + Number.EPSILON * Math.max(1, Math.abs(n), Math.abs(q.correctAnswer)) * 4;
    return {
      marks: correct ? q.marks : 0 - q.negativeMarks,
      outcome: correct ? 'correct' : 'incorrect',
    };
  }
  const chosen = Array.isArray(answer) ? [...new Set(answer)] : [];
  if (
    !Array.isArray(answer) ||
    chosen.some((a) => !q.options.some((o) => o.id === a)) ||
    (q.type === 'single-choice' && chosen.length !== 1)
  )
    return { marks: 0 - q.negativeMarks, outcome: 'incorrect' };
  const correct =
    chosen.length === q.correctOptionIds.length &&
    chosen.every((a) => q.correctOptionIds.includes(a));
  if (correct) return { marks: q.marks, outcome: 'correct' };
  if (q.type === 'multiple-select' && q.scoring.mode === 'partial') {
    const right = chosen.filter((a) => q.correctOptionIds.includes(a)).length;
    const marks = Math.min(
      q.marks,
      Math.max(
        0 - q.negativeMarks,
        right * q.scoring.perCorrectOption -
          (chosen.length - right) * q.scoring.incorrectSelectionPenalty,
      ),
    );
    return { marks, outcome: marks > 0 ? 'partial' : 'incorrect' };
  }
  return { marks: 0 - q.negativeMarks, outcome: 'incorrect' };
}
export const round = (n: number, precision = 2) => Number(n.toFixed(precision));
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}
export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function scoreAttempt(attempt: Attempt, completedAt: number): Result {
  const exam: Exam = attempt.exam,
    questions: QuestionResult[] = [];
  let negativeMarks = 0;
  const sections = exam.sections.map((s) => {
    const rows = s.questions.map((q) => ({
      id: q.id,
      sectionId: s.id,
      ...scoreQuestion(q, attempt.responses[q.id]?.answer),
    }));
    questions.push(...rows);
    const marks = rows.reduce((n, r) => n + r.marks, 0),
      maximum = s.questions.reduce((n, q) => n + q.marks, 0),
      percentage = (marks / maximum) * 100;
    negativeMarks += rows.reduce((n, r) => n + Math.max(0, -r.marks), 0);
    return {
      id: s.id,
      title: s.title,
      marks,
      maximum,
      percentage,
      qualified:
        marks + 1e-9 >= (s.minimumMarksToPass ?? -Infinity) &&
        percentage + 1e-9 >= (s.minimumPercentageToPass ?? -Infinity),
      hasThreshold: s.minimumMarksToPass !== undefined || s.minimumPercentageToPass !== undefined,
      correct: rows.filter((r) => r.outcome === 'correct').length,
      incorrect: rows.filter((r) => r.outcome === 'incorrect').length,
      partial: rows.filter((r) => r.outcome === 'partial').length,
      unanswered: rows.filter((r) => r.outcome === 'unanswered').length,
    };
  });
  const marks = sections.reduce((n, s) => n + s.marks, 0),
    maximum = sections.reduce((n, s) => n + s.maximum, 0),
    percentage = (marks / maximum) * 100;
  const correct = questions.filter((q) => q.outcome === 'correct').length,
    incorrect = questions.filter((q) => q.outcome === 'incorrect').length,
    partial = questions.filter((q) => q.outcome === 'partial').length,
    unanswered = questions.filter((q) => q.outcome === 'unanswered').length,
    attempted = questions.length - unanswered;
  const passed =
    marks + 1e-9 >= (exam.passCriteria.minimumMarks ?? -Infinity) &&
    percentage + 1e-9 >= (exam.passCriteria.minimumPercentage ?? -Infinity) &&
    (!exam.passCriteria.requireAllSectionMinimums ||
      sections.every((s) => !s.hasThreshold || s.qualified));
  const elapsedSeconds = Math.max(
    0,
    Math.min(exam.durationSeconds, (completedAt - attempt.startedAt) / 1000),
  );
  // Store raw aggregates; round only for presentation. Qualification uses raw scores.
  return {
    marks,
    maximum,
    percentage,
    passed,
    correct,
    incorrect,
    partial,
    attempted,
    unanswered,
    review: Object.values(attempt.responses).filter((r) => r.review).length,
    negativeMarks,
    accuracy: attempted ? (correct / attempted) * 100 : 0,
    sections,
    questions,
    elapsedSeconds,
    timeTaken: formatDuration(elapsedSeconds),
  };
}
