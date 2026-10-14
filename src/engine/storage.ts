import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { validateExam } from './schema';
import { numericValid, scoreAttempt } from './scoring';
import type { Attempt, ExamRecord } from './types';
interface Database extends DBSchema {
  exams: { key: string; value: ExamRecord };
  attempts: { key: string; value: Attempt; indexes: { 'by-status': string } };
  settings: { key: string; value: unknown };
}
export const DB_NAME = 'examdesk-local';
export const DB_VERSION = 2;
export function connect(name = DB_NAME) {
  return openDB<Database>(name, DB_VERSION, {
    upgrade(db, oldVersion, _, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('exams', { keyPath: 'id' });
        db.createObjectStore('attempts', { keyPath: 'id' });
        db.createObjectStore('settings');
      }
      if (oldVersion < 2) tx.objectStore('attempts').createIndex('by-status', 'status');
    },
    blocked() {
      window.dispatchEvent(new Event('database-blocked'));
    },
    blocking() {
      window.dispatchEvent(new Event('database-blocked'));
    },
  });
}
let connection: Promise<IDBPDatabase<Database>> | undefined;
export function database() {
  return (connection ??= connect());
}
export async function listData() {
  const db = await database();
  return { exams: await db.getAll('exams'), attempts: await db.getAll('attempts') };
}
export async function saveExam(record: ExamRecord) {
  const validation = validateExam(record.exam);
  if (!validation.exam) throw new Error('Exam is invalid. Review its configuration.');
  const db = await database();
  await db.put('exams', { ...record, exam: validation.exam });
}
export async function removeExam(id: string) {
  await (await database()).delete('exams', id);
}
export async function saveAttempt(attempt: Attempt): Promise<Attempt> {
  const db = await database(),
    tx = db.transaction('attempts', 'readwrite'),
    store = tx.objectStore('attempts');
  const existing = await store.get(attempt.id);
  if (existing?.status === 'completed') {
    await tx.done;
    return existing;
  }
  if (existing && existing.revision > attempt.revision) {
    await tx.done;
    throw new Error('A newer attempt was saved in another tab. Reload to recover it.');
  }
  if (!existing && attempt.status === 'active') {
    const active = await store.index('by-status').getAll('active');
    if (active.length) {
      await tx.done;
      throw new Error('Resume or discard your active examination before starting another.');
    }
  }
  await store.put(attempt);
  await tx.done;
  return attempt;
}
export async function removeAttempt(id: string) {
  await (await database()).delete('attempts', id);
}
export async function clearHistory() {
  const db = await database(),
    tx = db.transaction('attempts', 'readwrite');
  for (const a of await tx.store.getAll())
    if (a.status === 'completed') await tx.store.delete(a.id);
  await tx.done;
}
export async function getPreference<T>(key: string, fallback: T): Promise<T> {
  return ((await (await database()).get('settings', key)) as T | undefined) ?? fallback;
}
export async function setPreference(key: string, value: unknown) {
  await (await database()).put('settings', value, key);
}
export type Backup = {
  format: 'examdesk-backup';
  version: 1;
  exportedAt: number;
  exams: ExamRecord[];
  attempts: Attempt[];
};
export async function createBackup(): Promise<Backup> {
  return { format: 'examdesk-backup', version: 1, exportedAt: Date.now(), ...(await listData()) };
}
const finite = z.number().finite(),
  timestamp = finite.min(0);
const attemptShape = z
  .object({
    id: z.string().min(1).max(100),
    examId: z.string().min(1).max(100),
    exam: z.unknown(),
    candidate: z.string().min(1).max(100),
    startedAt: timestamp,
    deadline: timestamp,
    completedAt: timestamp.optional(),
    status: z.enum(['active', 'completed']),
    reason: z.enum(['manual', 'timeout', 'sections-expired']).optional(),
    currentSection: z.number().int().nonnegative(),
    currentQuestion: z.number().int().nonnegative(),
    sectionStartedAt: z.record(z.string(), timestamp),
    lockedSections: z.array(z.string()),
    responses: z.record(
      z.string(),
      z
        .object({
          answer: z.union([z.array(z.string()), z.string()]),
          visited: z.boolean(),
          review: z.boolean(),
        })
        .strict(),
    ),
    revision: z.number().int().nonnegative(),
    result: z.unknown().optional(),
  })
  .strict();
export function validateBackup(value: unknown): Backup {
  const root = z
    .object({
      format: z.literal('examdesk-backup'),
      version: z.literal(1),
      exportedAt: timestamp,
      exams: z
        .array(
          z
            .object({
              id: z.string().min(1),
              exam: z.unknown(),
              importedAt: timestamp,
              updatedAt: timestamp,
            })
            .strict(),
        )
        .max(1000),
      attempts: z.array(attemptShape).max(10000),
    })
    .strict()
    .parse(value);
  const exams: ExamRecord[] = root.exams.map((r) => {
    const v = validateExam(r.exam);
    if (!v.exam) throw new Error(`Invalid exam in backup: ${r.id}`);
    return { ...r, exam: v.exam };
  });
  const attempts: Attempt[] = root.attempts.map((r) => {
    const v = validateExam(r.exam);
    if (!v.exam) throw new Error(`Invalid exam snapshot in attempt ${r.id}.`);
    const exam = v.exam,
      s = exam.sections[r.currentSection];
    const bad = () => {
      throw new Error(`Inconsistent or corrupted attempt ${r.id}.`);
    };
    if (
      !s?.questions[r.currentQuestion] ||
      r.deadline !== r.startedAt + exam.durationSeconds * 1000
    )
      bad();
    if (
      r.status === 'completed' &&
      (r.completedAt === undefined ||
        r.completedAt < r.startedAt ||
        r.completedAt > r.deadline ||
        !r.reason)
    )
      bad();
    if (
      r.status === 'active' &&
      (r.completedAt !== undefined || r.result !== undefined || r.reason !== undefined)
    )
      bad();
    if (
      Object.entries(r.sectionStartedAt).some(
        ([id, t]) => !exam.sections.some((s) => s.id === id) || t < r.startedAt || t > r.deadline,
      ) ||
      r.sectionStartedAt[s.id] === undefined ||
      r.lockedSections.some((id) => !exam.sections.some((s) => s.id === id))
    )
      bad();
    const questions = exam.sections.flatMap((s) => s.questions);
    for (const [id, response] of Object.entries(r.responses)) {
      const q = questions.find((q) => q.id === id);
      if (!q) bad();
      if (q?.type === 'numerical') {
        if (typeof response.answer === 'string') {
          if (response.answer !== '' && !numericValid(response.answer, q.decimalPrecision)) bad();
        } else if (!(Array.isArray(response.answer) && response.answer.length === 0)) bad();
      } else if (
        q &&
        (!Array.isArray(response.answer) ||
          new Set(response.answer).size !== response.answer.length ||
          response.answer.some((id) => !q.options.some((o) => o.id === id)) ||
          (q.type === 'single-choice' && response.answer.length > 1))
      )
        bad();
    }
    const attempt: Attempt = { ...r, exam, result: undefined };
    if (attempt.status === 'completed')
      attempt.result = scoreAttempt(attempt, attempt.completedAt!);
    return attempt;
  });
  if (
    new Set(exams.map((e) => e.id)).size !== exams.length ||
    new Set(attempts.map((a) => a.id)).size !== attempts.length
  )
    throw new Error('Backup contains duplicate record IDs.');
  return { format: 'examdesk-backup', version: 1, exportedAt: root.exportedAt, exams, attempts };
}
export async function restoreBackup(backup: Backup) {
  const safe = validateBackup(backup),
    db = await database(),
    tx = db.transaction(['exams', 'attempts'], 'readwrite');
  let added = 0,
    skipped = 0;
  for (const e of safe.exams) {
    if (await tx.objectStore('exams').get(e.id)) skipped++;
    else {
      await tx.objectStore('exams').add(e);
      added++;
    }
  }
  // Active attempts are deliberately excluded: restoring one could resurrect or extend a live session.
  for (const a of safe.attempts) {
    if (a.status === 'active' || (await tx.objectStore('attempts').get(a.id))) skipped++;
    else {
      await tx.objectStore('attempts').add(a);
      added++;
    }
  }
  await tx.done;
  return { added, skipped };
}
export function download(name: string, data: unknown, type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
      type,
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function scoreboardCSV(attempts: Attempt[]) {
  return [
    [
      'Attempt ID',
      'Exam',
      'Profile',
      'Candidate',
      'Started at',
      'Completed at',
      'Configured seconds',
      'Elapsed seconds',
      'Time taken',
      'Status',
      'Marks',
      'Maximum',
      'Percentage',
      'Correct',
      'Incorrect',
      'Partial',
      'Unanswered',
      'Accuracy',
    ]
      .map(cell)
      .join(','),
    ...attempts
      .filter((a) => a.result)
      .map((a) =>
        [
          a.id,
          a.exam.examName,
          a.exam.examProfile,
          a.candidate,
          new Date(a.startedAt).toISOString(),
          new Date(a.completedAt!).toISOString(),
          a.exam.durationSeconds,
          a.result!.elapsedSeconds,
          a.result!.timeTaken,
          a.result!.passed ? 'Pass' : 'Fail',
          a.result!.marks,
          a.result!.maximum,
          a.result!.percentage,
          a.result!.correct,
          a.result!.incorrect,
          a.result!.partial,
          a.result!.unanswered,
          a.result!.accuracy,
        ]
          .map(cell)
          .join(','),
      ),
  ].join('\r\n');
}
