import { resolveProfile } from './profiles';
import type { Exam } from './schema';
import { hasAnswer, numericValid, scoreAttempt } from './scoring';
import type { Answer, Attempt, Response } from './types';
export function shuffle<T>(values: T[], random = Math.random): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function createAttempt(
  examId: string,
  config: Exam,
  candidate: string,
  now = Date.now(),
  random = Math.random,
): Attempt {
  const exam = structuredClone(config);
  exam.sections.sort((a, b) => a.order - b.order);
  for (const s of exam.sections) {
    if (exam.settings.shuffleQuestions) s.questions = shuffle(s.questions, random);
    if (exam.settings.shuffleOptions)
      for (const q of s.questions)
        if (q.type !== 'numerical') q.options = shuffle(q.options, random);
  }
  return {
    id: crypto.randomUUID(),
    examId,
    exam,
    candidate: candidate.trim() || 'Practice candidate',
    startedAt: now,
    deadline: now + exam.durationSeconds * 1000,
    status: 'active',
    currentSection: 0,
    currentQuestion: 0,
    sectionStartedAt: { [exam.sections[0].id]: now },
    lockedSections: [],
    responses: { [exam.sections[0].questions[0].id]: { answer: [], visited: true, review: false } },
    revision: 0,
  };
}
export function remaining(deadline: number, now = Date.now()) {
  return Math.max(0, (deadline - now) / 1000);
}
export function sectionDeadline(a: Attempt, index: number) {
  const s = a.exam.sections[index],
    start = a.sectionStartedAt[s.id];
  return s.durationSeconds !== undefined && start !== undefined
    ? Math.min(a.deadline, start + s.durationSeconds * 1000)
    : a.deadline;
}
export function finalize(a: Attempt, reason: Attempt['reason'], now = Date.now()): Attempt {
  if (a.status === 'completed') return a;
  const completedAt = Math.max(a.startedAt, Math.min(now, a.deadline));
  return {
    ...a,
    status: 'completed',
    reason,
    completedAt,
    result: scoreAttempt(a, completedAt),
    revision: a.revision + 1,
  };
}
export function visit(a: Attempt, si: number, qi: number, now: number): Attempt {
  const s = a.exam.sections[si],
    q = s?.questions[qi];
  if (!q) return a;
  return {
    ...a,
    currentSection: si,
    currentQuestion: qi,
    sectionStartedAt: { ...a.sectionStartedAt, [s.id]: a.sectionStartedAt[s.id] ?? now },
    responses: {
      ...a.responses,
      [q.id]: { ...(a.responses[q.id] ?? { answer: [], review: false }), visited: true },
    },
    revision: a.revision + 1,
  };
}
export function advanceTime(original: Attempt, now = Date.now()): Attempt {
  if (original.status === 'completed') return original;
  let a = original;
  for (let i = 0; i <= a.exam.sections.length; i++) {
    const expired = a.exam.sections
      .filter(
        (s, index) =>
          s.durationSeconds !== undefined &&
          a.sectionStartedAt[s.id] !== undefined &&
          now >= sectionDeadline(a, index),
      )
      .map((s) => s.id);
    const locked = [...new Set([...a.lockedSections, ...expired])];
    if (locked.length !== a.lockedSections.length)
      a = { ...a, lockedSections: locked, revision: a.revision + 1 };
    if (!locked.includes(a.exam.sections[a.currentSection].id))
      return now >= a.deadline ? finalize(a, 'timeout', a.deadline) : a;
    const next = a.exam.sections.findIndex(
      (s, index) => index > a.currentSection && !locked.includes(s.id),
    );
    const fallback = next >= 0 ? next : a.exam.sections.findIndex((s) => !locked.includes(s.id));
    if (fallback < 0) {
      // Several previously entered sections can expire during one suspended interval.
      // Exclude sections that were already locked (possibly manually) before this tick.
      const deadlines = a.exam.sections.flatMap((s, index) =>
        expired.includes(s.id) && !original.lockedSections.includes(s.id)
          ? [sectionDeadline(a, index)]
          : [],
      );
      const finish = Math.min(now, Math.max(sectionDeadline(a, a.currentSection), ...deadlines));
      return finalize(a, finish >= a.deadline ? 'timeout' : 'sections-expired', finish);
    }
    const entry =
      a.exam.settings.sectionExpiry === 'advance'
        ? sectionDeadline(a, a.currentSection)
        : Math.min(now, a.deadline);
    a = visit(a, fallback, sectionPosition(a, fallback), entry);
  }
  return a;
}
/** Reenter a forward-only section at its furthest visited question, never at question zero. */
export function sectionPosition(a: Attempt, si: number) {
  if (si === a.currentSection) return a.currentQuestion;
  const s = a.exam.sections[si];
  if (resolveProfile(a.exam, s).allowPrevious) return 0;
  return Math.max(
    0,
    s.questions.reduce((last, q, i) => (a.responses[q.id]?.visited ? i : last), -1),
  );
}
export function canNavigate(a: Attempt, si: number, qi: number) {
  const s = a.exam.sections[si];
  if (a.status !== 'active' || !s?.questions[qi] || a.lockedSections.includes(s.id)) return false;
  const p = resolveProfile(a.exam, s);
  if (si !== a.currentSection) {
    if (!a.exam.settings.allowSectionNavigation) return false;
    const furthest = Math.max(
      0,
      s.questions.reduce((last, q, i) => (a.responses[q.id]?.visited ? i : last), -1),
    );
    return (p.allowPrevious || qi >= furthest) && (p.allowQuestionNavigation || qi <= furthest + 1);
  }
  return (
    (qi >= a.currentQuestion || p.allowPrevious) &&
    (p.allowQuestionNavigation ||
      qi === a.currentQuestion ||
      qi === a.currentQuestion + 1 ||
      (p.allowPrevious && qi === a.currentQuestion - 1))
  );
}
export function navigate(a: Attempt, si: number, qi: number, now = Date.now()) {
  const current = advanceTime(a, now);
  return canNavigate(current, si, qi) ? visit(current, si, qi, now) : current;
}
export function nextSection(a: Attempt, now = Date.now()) {
  const current = advanceTime(a, now);
  if (current.status !== 'active' || current.currentSection !== a.currentSection) return current;
  const next = current.exam.sections.findIndex(
    (s, i) => i > current.currentSection && !current.lockedSections.includes(s.id),
  );
  if (next < 0) return current;
  const locked = current.exam.settings.allowSectionNavigation
    ? current.lockedSections
    : [...new Set([...current.lockedSections, current.exam.sections[current.currentSection].id])];
  return visit({ ...current, lockedSections: locked }, next, sectionPosition(current, next), now);
}
export function setResponse(
  a: Attempt,
  change: { answer?: Answer; review?: boolean },
  now = Date.now(),
) {
  const current = advanceTime(a, now);
  if (
    current.status !== 'active' ||
    current.currentSection !== a.currentSection ||
    current.currentQuestion !== a.currentQuestion
  )
    return current;
  const s = current.exam.sections[current.currentSection],
    q = s.questions[current.currentQuestion],
    p = resolveProfile(current.exam, s);
  if (change.review !== undefined && !p.allowReview) return current;
  if (change.answer !== undefined) {
    if (q.type === 'numerical') {
      if (
        typeof change.answer !== 'string' ||
        (change.answer !== '' && !numericValid(change.answer, q.decimalPrecision))
      )
        throw new Error(
          `Enter a valid number${q.decimalPrecision !== undefined ? ` with at most ${q.decimalPrecision} decimal places` : ''}.`,
        );
    } else if (
      !Array.isArray(change.answer) ||
      change.answer.some((id) => !q.options.some((o) => o.id === id)) ||
      (q.type === 'single-choice' && change.answer.length > 1)
    )
      throw new Error('Invalid option selection.');
  }
  return {
    ...current,
    responses: {
      ...current.responses,
      [q.id]: {
        ...(current.responses[q.id] ?? { answer: [], review: false }),
        ...change,
        visited: true,
      },
    },
    revision: current.revision + 1,
  };
}
export type QuestionStatus =
  'not-visited' | 'unanswered' | 'answered' | 'review' | 'answered-review' | 'locked';
export function questionStatus(r?: Response, locked = false): QuestionStatus {
  if (locked) return 'locked';
  if (r?.review) return hasAnswer(r.answer) ? 'answered-review' : 'review';
  if (hasAnswer(r?.answer)) return 'answered';
  return r?.visited ? 'unanswered' : 'not-visited';
}
