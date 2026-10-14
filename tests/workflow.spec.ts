import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import demo from '../public/examples/demo-engineering.json' with { type: 'json' };
import type { Attempt } from '../src/engine/types';
async function importPaper(page: Page, exam: unknown = demo) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import examination', exact: true }).click();
  await page.getByLabel('Exam JSON file').setInputFiles({
    name: 'paper.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exam)),
  });
}
async function saveAndStart(page: Page) {
  await page.getByRole('button', { name: 'Save to exam library' }).click();
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await page.getByLabel('I have read the instructions').check();
  await page.getByRole('button', { name: 'Start Examination', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Question 1/ })).toBeVisible();
}
async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit Examination', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await expect(page.getByRole('heading', { name: 'Your effort, in perspective.' })).toBeVisible();
}
async function records(page: Page): Promise<Attempt[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('examdesk-local');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction('attempts').objectStore('attempts').getAll();
          all.onsuccess = () => {
            resolve(all.result);
            db.close();
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}
test('import, configure missing pass mark, answer, recover, submit and keep repeated history', async ({
  page,
}) => {
  const exam = structuredClone(demo);
  (exam as { passCriteria?: unknown }).passCriteria = {};
  await importPaper(page, exam);
  await expect(
    page.getByText('Configure an overall minimum mark or percentage before starting.'),
  ).toBeVisible();
  await page.getByLabel('Overall minimum marks', { exact: true }).fill('4');
  await saveAndStart(page);
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click();
  await page.getByRole('checkbox', { name: 'A 2', exact: true }).check();
  await page.getByRole('checkbox', { name: 'C 17', exact: true }).check();
  await expect(page.getByText('Saved to this device')).toBeVisible();
  const before = (await records(page))[0];
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pick up where you left off.' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume examination' }).click();
  await expect(page.getByRole('checkbox', { name: 'A 2', exact: true })).toBeChecked();
  expect((await records(page))[0].deadline).toBe(before.deadline);
  await page.getByRole('button', { name: 'Engineering Mathematics', exact: true }).click();
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: 'Save & Next', exact: true }).click();
  await page.getByLabel('Numerical response').fill('1.41');
  await page.getByRole('button', { name: 'Save & Next', exact: true }).click();
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(2).check();
  await submit(page);
  await expect(page.getByText('PASS · QUALIFIED')).toBeVisible();
  await expect.poll(async () => (await records(page))[0].status).toBe('completed');
  const result = (await records(page))[0];
  expect(result.result?.marks).toBe(10);
  expect(result.result?.review).toBe(1);
  expect(result.completedAt).toBeGreaterThan(result.startedAt);
  expect(result.result?.elapsedSeconds).toBeLessThan(1200);
  await page.reload();
  await page.getByRole('button', { name: 'Scoreboard', exact: true }).click();
  await expect(page.locator('.scoreboard-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.scoreboard-table')).toContainText('100%');
  await page.getByRole('button', { name: 'Exam library', exact: false }).click();
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await page.getByLabel('I have read the instructions').check();
  await page.getByRole('button', { name: 'Start Examination', exact: true }).click();
  await submit(page);
  await expect
    .poll(async () => (await records(page)).filter((a) => a.status === 'completed').length)
    .toBe(2);
});
test('invalid JSON and answer keys never enter the library', async ({ page }) => {
  await importPaper(page, { ...demo, schemaVersion: '9' });
  await expect(page.getByText(/Invalid input: expected "1.0"/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to exam library' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Paste or edit JSON' }).click();
  await page.getByLabel('Examination JSON', { exact: true }).fill('{broken');
  await expect(page.getByText('Malformed JSON. Check commas, quotes and brackets.')).toBeVisible();
  const invalid = structuredClone(demo);
  invalid.sections[0].questions[0].correctOptionIds = ['missing'];
  await page.getByLabel('Examination JSON', { exact: true }).fill(JSON.stringify(invalid));
  await expect(page.getByText('Answer key missing does not exist in options.')).toBeVisible();
});
test('section timeout locks and advances without granting time; overall submits once', async ({
  page,
}) => {
  const exam = structuredClone(demo);
  exam.durationSeconds = 20;
  exam.sections[0].durationSeconds = 5;
  exam.sections[1].durationSeconds = 15;
  await page.clock.install();
  await importPaper(page, exam);
  await saveAndStart(page);
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await page.clock.fastForward(6000);
  await expect(page.getByRole('heading', { name: /Question 3/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'General Aptitude · Locked' })).toBeDisabled();
  await page.clock.fastForward(16000);
  await expect(page.getByRole('heading', { name: 'Your effort, in perspective.' })).toBeVisible();
  await expect.poll(async () => (await records(page))[0].status).toBe('completed');
  const rows = await records(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].result!.marks).toBe(2);
  expect(rows[0].result!.elapsedSeconds).toBe(20);
});
test('closed-tab deadline finalizes on reopening, not on a reset timer', async ({ page }) => {
  const exam = structuredClone(demo);
  exam.durationSeconds = 10;
  exam.sections.forEach((s) => delete (s as { durationSeconds?: number }).durationSeconds);
  await page.clock.install();
  await importPaper(page, exam);
  await saveAndStart(page);
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await expect(page.getByText('Saved to this device')).toBeVisible();
  await page.clock.setFixedTime(new Date(Date.now() + 60000));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your effort, in perspective.' })).toBeVisible();
  expect((await records(page))[0].result!.elapsedSeconds).toBe(10);
});
test('production assets and examinations work after going offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Practice with purpose.' })).toBeVisible();
  await page.getByRole('button', { name: 'Try the demo paper' }).click();
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await page.getByLabel('I have read the instructions').check();
  await page.getByRole('button', { name: 'Start Examination', exact: true }).click();
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await submit(page);
  await expect.poll(async () => (await records(page))[0].status).toBe('completed');
});
test('mobile screen exposes palette, clear response, review and submission', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importPaper(page);
  await saveAndStart(page);
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await page.getByRole('button', { name: 'Clear Response' }).click();
  await expect(page.getByRole('radio', { name: /60 km\/h/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click();
  await page.getByRole('button', { name: 'Question palette', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Question 1: Marked for review', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Question 1: Marked for review', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Question 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Question palette', exact: true }).click();
  await submit(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('storage errors are shown and can be retried without losing in-memory answers', async ({
  page,
}) => {
  await importPaper(page);
  await saveAndStart(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      IDBObjectStore.prototype.put = put;
      throw new DOMException('Simulated quota exceeded', 'QuotaExceededError');
      void args;
    };
  });
  await page.getByRole('radio', { name: /60 km\/h/ }).check();
  await expect(page.getByRole('alert')).toContainText('Local save failed');
  await page.getByRole('button', { name: 'Save failed · retry now' }).click();
  await expect(page.getByText('Saved to this device')).toBeVisible();
  expect((await records(page))[0].responses.q1.answer).toEqual(['B']);
});
test('backup export and restore preserve history and do not overwrite records', async ({
  page,
}) => {
  await importPaper(page);
  await saveAndStart(page);
  await submit(page);
  await page.getByRole('button', { name: 'Settings & data', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download full backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.getByLabel('Restore backup JSON').setInputFiles(path!);
  await page.getByRole('button', { name: 'Restore records' }).click();
  await expect(
    page.getByText('0 records restored; 2 existing or active records skipped.'),
  ).toBeVisible();
  expect(await records(page)).toHaveLength(1);
});

test('dashboard, examination and results pass automated WCAG A/AA checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Practice with purpose.' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await importPaper(page);
  await saveAndStart(page);
  await page.mouse.move(0, 0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await submit(page);
  await page.mouse.move(0, 0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
test('a second tab cannot race the examination writer', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Practice with purpose.' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(
    other.getByRole('heading', { name: 'ExamDesk is open in another tab' }),
  ).toBeVisible();
  await other.close();
});
