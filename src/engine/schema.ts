import { z } from 'zod';
const id = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]+$/,
    'Use letters, digits, underscores or hyphens; reserved JavaScript property names are not allowed',
  );
const nonnegative = z.number().finite().min(0).max(1e6);
const duration = z.number().int().min(1).max(604800);
const text = z.string().min(1).max(50000);
export const profileNames = [
  'ncbt-style',
  'railway',
  'jee-style',
  'gate-style',
  'nta-style',
  'generic',
  'custom',
] as const;
const navigation = z
  .object({
    allowQuestionNavigation: z.boolean().optional(),
    allowPrevious: z.boolean().optional(),
    allowReview: z.boolean().optional(),
  })
  .strict();
const baseQuestion = {
  id,
  questionText: text,
  marks: z.number().finite().positive().max(1e6),
  negativeMarks: nonnegative,
  explanation: z.string().max(50000).optional(),
  image: z
    .object({
      src: z
        .string()
        .max(2_000_000)
        .regex(
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
          'Use a base64 PNG, JPEG or WebP image (no remote URLs or SVG)',
        ),
      alt: z.string().min(1).max(500),
    })
    .strict()
    .optional(),
};
const choice = {
  options: z.array(z.object({ id, text }).strict()).min(2).max(20),
  correctOptionIds: z.array(id).min(1),
};
export const questionSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...baseQuestion,
      type: z.literal('single-choice'),
      ...choice,
      correctOptionIds: z.array(id).length(1),
    })
    .strict(),
  z
    .object({
      ...baseQuestion,
      type: z.literal('multiple-select'),
      ...choice,
      scoring: z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('exact') }).strict(),
        z
          .object({
            mode: z.literal('partial'),
            perCorrectOption: z.number().finite().positive().max(1e6),
            incorrectSelectionPenalty: nonnegative,
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      ...baseQuestion,
      type: z.literal('numerical'),
      correctAnswer: z.number().finite(),
      absoluteTolerance: nonnegative.optional(),
      relativeTolerance: z.number().finite().min(0).max(1).optional(),
      decimalPrecision: z.number().int().min(0).max(12).optional(),
    })
    .strict(),
]);
export const examSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    examId: id.optional(),
    examName: z.string().trim().min(1).max(200),
    examCode: z.string().max(80).optional(),
    examProfile: z.enum(profileNames),
    description: z.string().max(5000).optional(),
    language: z.string().min(2).max(20),
    durationSeconds: duration,
    totalMarks: nonnegative.optional(),
    passCriteria: z
      .object({
        minimumMarks: nonnegative.optional(),
        minimumPercentage: z.number().min(0).max(100).optional(),
        requireAllSectionMinimums: z.boolean().default(false),
      })
      .strict(),
    settings: z
      .object({
        allowSectionNavigation: z.boolean().default(true),
        shuffleQuestions: z.boolean().default(false),
        shuffleOptions: z.boolean().default(false),
        allowCalculator: z.boolean().default(false),
        showSolutionsAfterSubmit: z.boolean().default(true),
        autosave: z.literal(true).default(true),
        autoSubmitOnTimeExpiry: z.literal(true).default(true),
        sectionExpiry: z.enum(['lock', 'advance']).optional(),
        allowQuestionNavigation: z.boolean().optional(),
        allowPrevious: z.boolean().optional(),
        allowReview: z.boolean().optional(),
        scorePrecision: z.number().int().min(0).max(8).default(2),
        warningSeconds: z.array(z.number().int().positive().max(604800)).max(10).default([300, 60]),
        presentation: z
          .object({
            palettePosition: z.enum(['left', 'right']).optional(),
            accent: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
            showCandidate: z.boolean().optional(),
            compactOptions: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .default({
        allowSectionNavigation: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        allowCalculator: false,
        showSolutionsAfterSubmit: true,
        autosave: true,
        autoSubmitOnTimeExpiry: true,
        scorePrecision: 2,
        warningSeconds: [300, 60],
      }),
    sections: z
      .array(
        z
          .object({
            id,
            title: z.string().trim().min(1).max(200),
            order: z.number().int().min(0),
            durationSeconds: duration.optional(),
            minimumMarksToPass: nonnegative.optional(),
            minimumPercentageToPass: z.number().min(0).max(100).optional(),
            settings: navigation.optional(),
            questions: z.array(questionSchema).min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export type Exam = z.infer<typeof examSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Section = Exam['sections'][number];
export type ProfileName = Exam['examProfile'];
export type Issue = { path: string; message: string };
export function maxMarks(exam: Exam) {
  return exam.sections.reduce((sum, s) => sum + s.questions.reduce((v, q) => v + q.marks, 0), 0);
}
export function questionCount(exam: Exam) {
  return exam.sections.reduce((n, s) => n + s.questions.length, 0);
}
export function validateExam(input: unknown): { exam?: Exam; errors: Issue[]; warnings: Issue[] } {
  const parsed = examSchema.safeParse(input);
  if (!parsed.success)
    return {
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join('.') || 'exam',
        message: i.message,
      })),
      warnings: [],
    };
  const exam = parsed.data,
    errors: Issue[] = [],
    warnings: Issue[] = [];
  const error = (path: string, message: string) => errors.push({ path, message });
  if (
    exam.passCriteria.minimumMarks === undefined &&
    exam.passCriteria.minimumPercentage === undefined
  )
    error('passCriteria', 'Configure an overall minimum mark or percentage before starting.');
  const maximum = maxMarks(exam);
  if ((exam.passCriteria.minimumMarks ?? 0) > maximum)
    error('passCriteria.minimumMarks', 'Cannot exceed calculated maximum marks.');
  if (exam.totalMarks !== undefined && Math.abs(exam.totalMarks - maximum) > 1e-8)
    warnings.push({
      path: 'totalMarks',
      message: `Declared ${exam.totalMarks}; calculated ${maximum}. Scoring uses the calculated maximum.`,
    });
  if (exam.sections.some((s) => s.durationSeconds !== undefined) && !exam.settings.sectionExpiry)
    error('settings.sectionExpiry', 'Choose lock or advance for timed section expiry.');
  const sections = new Set<string>(),
    questions = new Set<string>(),
    orders = new Set<number>();
  exam.sections.forEach((s, si) => {
    const path = `sections.${si} [${s.id}]`;
    if (sections.has(s.id)) error(`${path}.id`, 'Duplicate section ID.');
    sections.add(s.id);
    if (orders.has(s.order)) error(`${path}.order`, 'Duplicate section order.');
    orders.add(s.order);
    const total = s.questions.reduce((n, q) => n + q.marks, 0);
    if ((s.minimumMarksToPass ?? 0) > total)
      error(`${path}.minimumMarksToPass`, 'Cannot exceed section maximum marks.');
    if (s.durationSeconds && s.durationSeconds > exam.durationSeconds)
      warnings.push({
        path: `${path}.durationSeconds`,
        message: 'Section time is capped by the overall deadline.',
      });
    s.questions.forEach((q, qi) => {
      const p = `${path}.questions.${qi} [${q.id}]`;
      if (questions.has(q.id)) error(`${p}.id`, 'Duplicate question ID across the examination.');
      questions.add(q.id);
      if (q.type !== 'numerical') {
        const ids = q.options.map((o) => o.id);
        if (new Set(ids).size !== ids.length) error(`${p}.options`, 'Duplicate option ID.');
        if (new Set(q.correctOptionIds).size !== q.correctOptionIds.length)
          error(`${p}.correctOptionIds`, 'Duplicate correct-answer reference.');
        q.correctOptionIds.forEach((key) => {
          if (!ids.includes(key))
            error(`${p}.correctOptionIds`, `Answer key ${key} does not exist in options.`);
        });
        if (
          q.type === 'multiple-select' &&
          q.scoring.mode === 'partial' &&
          Math.abs(q.scoring.perCorrectOption * q.correctOptionIds.length - q.marks) > 1e-8
        )
          error(
            `${p}.scoring.perCorrectOption`,
            'Per-correct credit × correct option count must equal question marks.',
          );
      }
    });
  });
  if (exam.settings.shuffleOptions)
    warnings.push({
      path: 'settings.shuffleOptions',
      message: 'Ensure options do not refer to positions (e.g. “all of the above”).',
    });
  if (exam.settings.shuffleQuestions)
    warnings.push({
      path: 'settings.shuffleQuestions',
      message: 'Ensure questions do not depend on their original sequence.',
    });
  return { exam: errors.length ? undefined : exam, errors, warnings };
}
export function parseExam(source: string) {
  try {
    return validateExam(JSON.parse(source));
  } catch {
    return {
      errors: [{ path: 'JSON', message: 'Malformed JSON. Check commas, quotes and brackets.' }],
      warnings: [],
    };
  }
}
