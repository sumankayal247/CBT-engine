import { describe, expect, it } from 'vitest';
import demo from '../../public/examples/demo-engineering.json';
import { maxMarks, parseExam, validateExam, type Exam, type Question } from './schema';
import {
  advanceTime,
  canNavigate,
  createAttempt,
  finalize,
  navigate,
  nextSection,
  questionStatus,
  remaining,
  sectionDeadline,
  setResponse,
  shuffle,
} from './attempt';
import { clock, formatDuration, scoreAttempt, scoreQuestion } from './scoring';
import { resolveProfile } from './profiles';
import { calculate } from './calculator';
const exam = () => validateExam(structuredClone(demo)).exam!;
const start = () => createAttempt('e', exam(), 'Test', 1000);
const numerical: Question = {
  id: 'n',
  type: 'numerical',
  questionText: 'n',
  marks: 2,
  negativeMarks: 0.25,
  correctAnswer: 100,
  absoluteTolerance: 0.1,
  relativeTolerance: 0.01,
};
describe('validation', () => {
  it('normalizes a versioned examination and calculates maximum', () => {
    const v = validateExam(demo);
    expect(v.errors).toEqual([]);
    expect(maxMarks(v.exam!)).toBe(10);
    expect(v.exam?.settings.scorePrecision).toBe(2);
  });
  it('rejects malformed JSON and unsupported versions', () => {
    expect(parseExam('{').errors[0].path).toBe('JSON');
    expect(validateExam({ ...demo, schemaVersion: '2' }).errors[0].path).toBe('schemaVersion');
  });
  it('requires an explicit overall pass criterion', () => {
    const e = exam();
    e.passCriteria = { requireAllSectionMinimums: false };
    expect(validateExam(e).errors[0].path).toBe('passCriteria');
  });
  it('requires an explicit section expiry policy', () => {
    const e = exam();
    delete e.settings.sectionExpiry;
    expect(validateExam(e).errors.some((i) => i.path === 'settings.sectionExpiry')).toBe(true);
  });
  it.each(['section', 'question', 'option', 'key', 'order'])(
    'rejects duplicate %s IDs / order',
    (kind) => {
      const e = exam();
      if (kind === 'section') e.sections[1].id = e.sections[0].id;
      if (kind === 'question') e.sections[1].questions[0].id = 'q1';
      if (kind === 'order') e.sections[1].order = e.sections[0].order;
      const q = e.sections[0].questions[0];
      if (q.type !== 'numerical') {
        if (kind === 'option') q.options[1].id = q.options[0].id;
        if (kind === 'key') q.correctOptionIds = ['invalid'];
      }
      expect(validateExam(e).errors.length).toBeGreaterThan(0);
    },
  );
  it.each([
    { durationSeconds: 0 },
    { sections: [] },
    { durationSeconds: '60' },
    { examProfile: 'official' },
    { passCriteria: { minimumMarks: 500 } },
    { settings: { autosave: false } },
  ])('rejects invalid fields %j', (patch) => {
    expect(validateExam({ ...demo, ...patch }).errors.length).toBeGreaterThan(0);
  });
  it('rejects missing explicit multiple-select scoring', () => {
    const e = structuredClone(demo);
    delete (e.sections[0].questions[1] as { scoring?: unknown }).scoring;
    expect(validateExam(e).errors.length).toBeGreaterThan(0);
  });
  it('rejects impossible partial credit and section thresholds', () => {
    const e = exam();
    const q = e.sections[0].questions[1];
    if (q.type === 'multiple-select')
      q.scoring = { mode: 'partial', perCorrectOption: 5, incorrectSelectionPenalty: 1 };
    e.sections[0].minimumMarksToPass = 20;
    expect(validateExam(e).errors).toHaveLength(2);
  });
  it.each(['__proto__', 'constructor', 'prototype'])('rejects reserved record-map IDs %s', (id) => {
    const e = exam();
    e.sections[0].id = id;
    expect(validateExam(e).errors.length).toBeGreaterThan(0);
  });
  it('warns but does not block declared mark mismatch', () => {
    const v = validateExam({ ...demo, totalMarks: 999 });
    expect(v.exam).toBeDefined();
    expect(v.warnings[0].path).toBe('totalMarks');
  });
  it.each(['https://example.com/img.png', 'data:image/svg+xml;base64,abc', 'javascript:alert(1)'])(
    'rejects unsafe or network media %s',
    (src) => {
      const e = exam();
      e.sections[0].questions[0].image = { src, alt: 'test' };
      expect(validateExam(e).errors.length).toBeGreaterThan(0);
    },
  );
});
describe('scoring', () => {
  it.each([
    { answer: ['B'], marks: 2, outcome: 'correct' },
    { answer: ['A'], marks: -0.5, outcome: 'incorrect' },
    { answer: [], marks: 0, outcome: 'unanswered' },
    { answer: ['B', 'A'], marks: -0.5, outcome: 'incorrect' },
  ])('scores single choice $outcome', ({ answer, marks, outcome }) => {
    expect(scoreQuestion(exam().sections[0].questions[0], answer)).toEqual({ marks, outcome });
  });
  it('scores exact-match multiple selections regardless of order', () => {
    const q = exam().sections[1].questions[2];
    expect(scoreQuestion(q, ['C', 'A']).marks).toBe(2);
    expect(scoreQuestion(q, ['A']).marks).toBe(0);
    expect(scoreQuestion(q, ['C', 'A', 'B']).outcome).toBe('incorrect');
  });
  it('applies explicit partial credit and lower bound', () => {
    const q = exam().sections[0].questions[1];
    expect(scoreQuestion(q, ['A'])).toEqual({ marks: 1, outcome: 'partial' });
    expect(scoreQuestion(q, ['B', 'D']).marks).toBe(-0.5);
    expect(scoreQuestion(q, ['A', 'B']).marks).toBe(0);
  });
  it.each([
    ['101', 2],
    ['99', 2],
    ['101.001', -0.25],
    ['', 0],
    ['NaN', -0.25],
    ['1e2', -0.25],
  ])('scores numerical %s with absolute / relative tolerances', (answer, marks) => {
    expect(scoreQuestion(numerical, answer).marks).toBe(marks);
  });
  it('handles floating point tolerance boundaries and zero', () => {
    expect(
      scoreQuestion(
        { ...numerical, correctAnswer: 0.3, absoluteTolerance: 0.1, relativeTolerance: 0 },
        '0.4',
      ).marks,
    ).toBe(2);
    expect(
      scoreQuestion(
        { ...numerical, correctAnswer: 0, absoluteTolerance: 0, relativeTolerance: 0.1 },
        '0.001',
      ).marks,
    ).toBe(-0.25);
  });
  it('enforces numerical precision', () => {
    expect(scoreQuestion({ ...numerical, decimalPrecision: 1 }, '100.00').outcome).toBe(
      'incorrect',
    );
  });
  it('scores from responses, not review flags or counters', () => {
    let a = start();
    a = setResponse(a, { answer: ['B'], review: true }, 2000);
    const r = scoreAttempt(a, 6000);
    expect(r.marks).toBe(2);
    expect(r.review).toBe(1);
    expect(r.correct).toBe(1);
    expect(r.unanswered).toBe(4);
    expect(r.elapsedSeconds).toBe(5);
    expect(r.passed).toBe(false);
  });
  it('requires overall AND section qualification when enabled', () => {
    const a = start();
    for (const s of a.exam.sections)
      for (const q of s.questions)
        a.responses[q.id] = {
          answer: q.type === 'numerical' ? String(q.correctAnswer) : q.correctOptionIds,
          visited: true,
          review: false,
        };
    expect(scoreAttempt(a, 5000).passed).toBe(true);
    a.responses.q1.answer = [];
    a.responses.q2.answer = [];
    expect(scoreAttempt(a, 5000).marks).toBe(6);
    expect(scoreAttempt(a, 5000).passed).toBe(false);
    a.exam.passCriteria.requireAllSectionMinimums = false;
    expect(scoreAttempt(a, 5000).passed).toBe(true);
  });
  it('does not invent a section threshold when none is configured', () => {
    const a = setResponse(start(), { answer: ['A'] }, 2000);
    delete a.exam.sections[0].minimumMarksToPass;
    const s = scoreAttempt(a, 5000).sections[0];
    expect(s.marks).toBe(-0.5);
    expect(s.hasThreshold).toBe(false);
    expect(s.qualified).toBe(true);
  });
  it('does not round individual fractional scores or pass criteria', () => {
    const a = start();
    a.exam.sections = [
      {
        id: 's',
        title: 'S',
        order: 0,
        questions: [1, 2, 3].map((i) => ({
          id: `p${i}`,
          type: 'numerical',
          questionText: '?',
          marks: 1 / 3,
          negativeMarks: 0,
          correctAnswer: 1,
        })),
      },
    ];
    a.exam.passCriteria = { minimumMarks: 1, requireAllSectionMinimums: false };
    for (const q of a.exam.sections[0].questions)
      a.responses[q.id] = { answer: '1', visited: true, review: false };
    expect(scoreAttempt(a, 5000).marks).toBe(1);
    expect(scoreAttempt(a, 5000).passed).toBe(true);
    a.exam.passCriteria.minimumMarks = 1.001;
    expect(scoreAttempt(a, 5000).passed).toBe(false);
  });
  it('stores completion duration separately and clamps it to deadline', () => {
    const a = finalize(start(), 'timeout', 2_000_000);
    expect(a.completedAt).toBe(a.deadline);
    expect(a.result!.elapsedSeconds).toBe(1200);
    expect(a.result!.timeTaken).toBe('0h 20m 00s');
  });
});
describe('state and navigation', () => {
  it('tracks every independent status and clear response', () => {
    let a = start();
    expect(questionStatus()).toBe('not-visited');
    expect(questionStatus(a.responses.q1)).toBe('unanswered');
    a = setResponse(a, { review: true }, 2000);
    expect(questionStatus(a.responses.q1)).toBe('review');
    a = setResponse(a, { answer: ['B'] }, 2000);
    expect(questionStatus(a.responses.q1)).toBe('answered-review');
    a = setResponse(a, { review: false }, 2000);
    expect(questionStatus(a.responses.q1)).toBe('answered');
    a = setResponse(a, { answer: [] }, 2000);
    expect(questionStatus(a.responses.q1)).toBe('unanswered');
    expect(questionStatus(a.responses.q1, true)).toBe('locked');
  });
  it('honors section overrides and sequential locks', () => {
    const e = exam();
    e.settings.allowSectionNavigation = false;
    e.sections[0].settings = { allowPrevious: false, allowReview: false };
    let a = createAttempt('e', e, 'T', 1000);
    expect(canNavigate(a, 1, 0)).toBe(false);
    a = navigate(a, 0, 1, 2000);
    expect(canNavigate(a, 0, 0)).toBe(false);
    expect(setResponse(a, { review: true }, 2000)).toBe(a);
    a = nextSection(a, 3000);
    expect(a.lockedSections).toContain('aptitude');
    expect(canNavigate(a, 0, 0)).toBe(false);
  });
  it('cannot bypass forward-only navigation by switching sections', () => {
    const e = exam();
    e.sections[0].settings = { allowPrevious: false };
    let a = createAttempt('e', e, 'T', 1000);
    a = navigate(a, 0, 1, 2000);
    a = navigate(a, 1, 0, 3000);
    expect(canNavigate(a, 0, 0)).toBe(false);
    expect(canNavigate(a, 0, 1)).toBe(true);
  });
  it('rejects invalid responses before persistence', () => {
    expect(() => setResponse(start(), { answer: ['nope'] }, 2000)).toThrow();
    const a = navigate(start(), 1, 1, 2000);
    expect(() => setResponse(a, { answer: '1.414' }, 2000)).toThrow();
  });
  it('isolates immutable snapshots, randomized order, and separate attempts', () => {
    const e = exam();
    e.settings.shuffleOptions = true;
    e.settings.shuffleQuestions = true;
    const a = createAttempt('e', e, 'T', 1000, () => 0),
      b = createAttempt('e', e, 'T', 1000);
    expect(a.id).not.toBe(b.id);
    expect(a.exam.sections[0].questions[0].id).toBe('q2');
    expect(structuredClone(a).exam).toEqual(a.exam);
    e.examName = 'changed';
    expect(a.exam.examName).not.toBe('changed');
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
  it('resolves presentation and per-section behavior without scoring differences', () => {
    const e = exam();
    e.settings.presentation = { palettePosition: 'left', accent: '#112233' };
    expect(resolveProfile(e).palettePosition).toBe('left');
    expect(
      resolveProfile(e, { ...e.sections[0], settings: { allowPrevious: false } }).allowPrevious,
    ).toBe(false);
  });
});
describe('wall-clock timers', () => {
  function short(policy: 'lock' | 'advance' = 'advance'): Exam {
    const e = exam();
    e.durationSeconds = 60;
    e.sections.forEach((s) => (s.durationSeconds = 10));
    e.settings.sectionExpiry = policy;
    return e;
  }
  it('starts only at createAttempt and calculates wall-clock time', () => {
    const a = start();
    expect(a.startedAt).toBe(1000);
    expect(remaining(a.deadline, 10000)).toBe(1191);
    expect(clock(65)).toBe('00:01:05');
    expect(formatDuration(4112)).toBe('1h 08m 32s');
  });
  it('does not reset a section deadline on revisiting or refresh', () => {
    let a = start();
    const deadline = sectionDeadline(a, 0);
    a = navigate(a, 1, 0, 2000);
    a = navigate(structuredClone(a), 0, 0, 5000);
    expect(sectionDeadline(a, 0)).toBe(deadline);
  });
  it('locks expired sections and advances at the original section deadline', () => {
    let a = createAttempt('e', short(), 'T', 1000);
    a = advanceTime(a, 15000);
    expect(a.currentSection).toBe(1);
    expect(a.lockedSections).toContain('aptitude');
    expect(a.sectionStartedAt.mathematics).toBe(11000);
    expect(sectionDeadline(a, 1)).toBe(21000);
  });
  it('catches up through multiple expirations during tab suspension', () => {
    const a = advanceTime(createAttempt('e', short(), 'T', 1000), 70000);
    expect(a.status).toBe('completed');
    expect(a.completedAt).toBe(21000);
    expect(a.result?.elapsedSeconds).toBe(20);
  });
  it('uses the last outstanding deadline when multiple visited sections expire together', () => {
    const e = short();
    e.durationSeconds = 200;
    e.sections[0].durationSeconds = 100;
    e.sections[1].durationSeconds = 50;
    const a = navigate(createAttempt('e', e, 'T', 1000), 1, 0, 11000);
    const done = advanceTime(a, 180000);
    expect(done.completedAt).toBe(101000);
    expect(done.result?.elapsedSeconds).toBe(100);
  });
  it('lock-only policy begins next section on return, capped by overall deadline', () => {
    const a = advanceTime(createAttempt('e', short('lock'), 'T', 1000), 15000);
    expect(a.sectionStartedAt.mathematics).toBe(15000);
    expect(a.lockedSections).toContain('aptitude');
    expect(advanceTime(a, 100000).status).toBe('completed');
  });
  it('overall deadline is enforced without per-section timers', () => {
    const e = short();
    e.sections.forEach((s) => delete s.durationSeconds);
    const a = advanceTime(createAttempt('e', e, 'T', 1000), 61000);
    expect(a.reason).toBe('timeout');
    expect(a.completedAt).toBe(61000);
  });
  it('does not accept a late response in an expired section', () => {
    const a = setResponse(createAttempt('e', short(), 'T', 1000), { answer: ['B'] }, 12000);
    expect(a.responses.q1.answer).toEqual([]);
    expect(a.currentSection).toBe(1);
  });
  it('does not double-advance on a navigation click after expiry', () => {
    const a = createAttempt('e', short(), 'T', 1000);
    expect(nextSection(a, 12000).currentSection).toBe(1);
  });
  it('manual and auto submission use identical scoring and are idempotent', () => {
    const a = setResponse(start(), { answer: ['B'] }, 2000);
    const manual = finalize(a, 'manual', 5000),
      auto = advanceTime(a, a.deadline + 1000);
    expect(manual.result!.marks).toBe(auto.result!.marks);
    expect(finalize(manual, 'timeout', 9000)).toBe(manual);
    expect(setResponse(manual, { answer: ['A'] }, 6000)).toBe(manual);
  });
});
describe('safe calculator', () => {
  it.each([
    ['2+3*4', 14],
    ['(2+3)*4', 20],
    ['sqrt(9)+2^3', 11],
    ['-2+4', 2],
    ['sin(pi/2)', 1],
  ])('evaluates %s', (expression, result) => expect(calculate(expression)).toBeCloseTo(result));
  it.each(['1/0', 'alert(1)', 'globalThis', '2+', '<script>'])('rejects %s', (value) =>
    expect(() => calculate(value)).toThrow(),
  );
});
