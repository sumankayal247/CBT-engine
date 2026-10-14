import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBObjectStore } from 'fake-indexeddb';
import { openDB } from 'idb';
import demo from '../../public/examples/demo-engineering.json';
import { validateExam } from './schema';
import { createAttempt, finalize, setResponse } from './attempt';
import {
  clearHistory,
  connect,
  createBackup,
  database,
  listData,
  removeExam,
  restoreBackup,
  saveAttempt,
  saveExam,
  scoreboardCSV,
  validateBackup,
} from './storage';
const exam = () => validateExam(demo).exam!;
const record = () => ({ id: 'exam-1', exam: exam(), importedAt: 1000, updatedAt: 1000 });
const active = () => createAttempt('exam-1', exam(), 'Tester', 1000);
beforeEach(async () => {
  const db = await database();
  await db.clear('exams');
  await db.clear('attempts');
  await db.clear('settings');
});
describe('IndexedDB transactions and history', () => {
  it('persists imported examinations and rejects invalid ones', async () => {
    await saveExam(record());
    expect((await listData()).exams[0].exam.examName).toBe(demo.examName);
    const bad = record();
    bad.exam.sections = [];
    await expect(saveExam(bad)).rejects.toThrow('invalid');
  });
  it('recovers answers, review flags and original deadlines', async () => {
    const a = setResponse(active(), { answer: ['B'], review: true }, 2000);
    await saveAttempt(a);
    const restored = (await listData()).attempts[0];
    expect(restored.responses.q1).toEqual({ answer: ['B'], visited: true, review: true });
    expect(restored.deadline).toBe(a.deadline);
    expect(restored.sectionStartedAt).toEqual(a.sectionStartedAt);
  });
  it('atomically finalizes one record and ignores late active saves', async () => {
    const a = active();
    await saveAttempt(a);
    const result = finalize(setResponse(a, { answer: ['B'] }, 2000), 'manual', 6000);
    await Promise.all([saveAttempt(result), saveAttempt(a), saveAttempt(result)]);
    const data = await listData();
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].status).toBe('completed');
    expect(data.attempts[0].result!.marks).toBe(2);
    expect(data.attempts[0].completedAt).toBe(6000);
  });
  it('prevents a second live attempt and stale revisions', async () => {
    const a = active();
    await saveAttempt(a);
    await expect(saveAttempt(active())).rejects.toThrow('active');
    await saveAttempt(setResponse(a, { answer: ['B'] }, 2000));
    await expect(saveAttempt(a)).rejects.toThrow('newer');
  });
  it('preserves repeated attempts and immutable snapshots across replacement/removal', async () => {
    await saveExam(record());
    const first = finalize(active(), 'manual', 2000),
      second = finalize(active(), 'manual', 3000);
    await saveAttempt(first);
    await saveAttempt(second);
    const updated = record();
    updated.exam.examName = 'Updated paper';
    await saveExam(updated);
    await removeExam(updated.id);
    const data = await listData();
    expect(data.exams).toHaveLength(0);
    expect(data.attempts).toHaveLength(2);
    expect(data.attempts[0].exam.examName).toBe(demo.examName);
  });
  it('clears completed history without deleting active attempts or exams', async () => {
    await saveExam(record());
    await saveAttempt(finalize(active(), 'manual', 2000));
    await saveAttempt(active());
    await clearHistory();
    const data = await listData();
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].status).toBe('active');
    expect(data.exams).toHaveLength(1);
  });
  it('surfaces storage quota failures rather than claiming success', async () => {
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    await expect(saveExam(record())).rejects.toThrow('Storage full');
    spy.mockRestore();
    expect((await listData()).exams).toHaveLength(0);
  });
  it('upgrades a v1 database without deleting its history', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('exams', { keyPath: 'id' });
        db.createObjectStore('attempts', { keyPath: 'id' });
        db.createObjectStore('settings');
      },
    });
    const a = finalize(active(), 'manual', 2000);
    await old.put('attempts', a);
    old.close();
    const next = await connect(name);
    expect(next.version).toBe(2);
    expect(await next.getFromIndex('attempts', 'by-status', 'completed')).toEqual(a);
    next.close();
  });
});
describe('export and restore', () => {
  it('restores validated records without overwrites and skips active sessions', async () => {
    await saveExam(record());
    await saveAttempt(finalize(active(), 'manual', 3000));
    await saveAttempt(active());
    const backup = await createBackup();
    const db = await database();
    await db.clear('attempts');
    await db.clear('exams');
    expect(await restoreBackup(backup)).toEqual({ added: 2, skipped: 1 });
    expect(await restoreBackup(backup)).toEqual({ added: 0, skipped: 3 });
    expect((await listData()).attempts).toHaveLength(1);
  });
  it('recalculates results instead of trusting imported totals', async () => {
    await saveAttempt(finalize(active(), 'manual', 5000));
    const backup = await createBackup();
    backup.attempts[0].result!.marks = 999;
    backup.attempts[0].result!.passed = true;
    const validated = validateBackup(backup);
    expect(validated.attempts[0].result!.marks).toBe(0);
    expect(validated.attempts[0].result!.passed).toBe(false);
  });
  it('rejects malformed, executable or inconsistent backups before writing', async () => {
    await saveExam(record());
    const backup = await createBackup();
    backup.attempts = [finalize(active(), 'manual', 3000)];
    backup.attempts[0].deadline += 1000;
    await expect(restoreBackup(backup)).rejects.toThrow('corrupted');
    expect((await listData()).attempts).toHaveLength(0);
    expect(() => validateBackup({ format: 'wrong' })).toThrow();
  });
  it('rejects duplicate backup IDs', async () => {
    const backup = await createBackup();
    backup.exams = [record(), record()];
    expect(() => validateBackup(backup)).toThrow('duplicate');
  });
  it('includes timestamps and elapsed duration and escapes CSV injection', () => {
    const a = finalize(active(), 'manual', 5000);
    a.exam.examName = '=HYPERLINK("evil")';
    const csv = scoreboardCSV([a]);
    expect(csv).toContain('Completed at');
    expect(csv).toContain('Elapsed seconds');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('0h 00m 04s');
  });
});
