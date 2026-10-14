# ExamDesk — Indian Competitive CBT Engine

Live demo: https://sumankayal247.github.io/CBT-engine/

An offline-first, configurable examination practice application. **One engine, configurable exams.** React + TypeScript, Vite, Bootstrap 5, IndexedDB (`idb`), Zod and locally bundled KaTeX. No backend is needed.

> Practice simulator only. Presets are editable approximations of common CBT workflows, not official portals, official marking rules or official results. No official identity assets are included.

## Run locally

Node.js **22.12 or newer** (Node 22 LTS recommended) and npm are required.

```bash
npm ci
npm run dev
```

Open the Vite URL (normally port 5173). The dev server binds to `0.0.0.0` and allows Arena preview hosts. Browser-facing requests use relative paths. No backend is needed.

```bash
npm run lint
npm test
npm run build
npm run preview -- --port 4173
```

Deploy the contents of `dist/` to an HTTPS static host at the domain root. No server secrets or environment variables are required. `localhost` is also a secure context for testing. HTTPS is required for service-worker/PWA functionality in many browsers.

### Browser end-to-end tests

After building, leave the preview server running in a separate terminal:

```bash
npm run preview -- --port 4173
# another terminal
npm run test:e2e
```

Tests run against the **production** build, including its service worker. A development-only `@sparticuz/chromium` binary is installed through npm for Linux environments without a system browser. The suite covers import and missing pass-criterion setup, all question types, navigation, review/clear, refresh recovery, final scoring, repeat history, invalid JSON and answer keys, section and overall timers, and user-facing error flows.

## Use the application

1. **Import examination**: choose/drop JSON or paste it into the editor. An actual library record is created only after validation and Save. Nothing is prepopulated with fake exams or scores.
2. Download [`public/examples/demo-engineering.json`](public/examples/demo-engineering.json), or select **Try the demo paper** to import it explicitly. It contains single choice, multiple select and numeric questions plus instructions and answer review behaviour.
3. Review validation errors and warnings. Configure missing duration/pass/timed-section rules, choose a profile and edit supported settings. Section timer/qualification/navigation fields are editable when allowed by the profile.
4. Start a paper from the library, read its instructions, enter a candidate name, acknowledge and click **Start Examination**. Only this click starts the timer.
5. Responses save immediately to IndexedDB. Use Previous, Save & Next, review flags, Clear Response and the question palette. Profile/section rules determine available navigation. Timers are absolute and resume on page reloads.
6. Submit after confirmation, or let the timer submit. Results include section qualification, actual elapsed time (separate from completion timestamp), accuracy and configurable answer review.
7. Reopen the **Scoreboard** to search/filter/sort, review records, see historical trends or export CSV/full attempt JSON. Repeating, replacing or removing a paper never erases old attempt snapshots.
8. **Settings & data** exports/restores a full validated backup. Local data belongs to this browser profile and origin; clearing it can permanently remove everything.

## Features

- Generic, Railway, JEE-style, GATE-style, NTA-style, NCBT-style and Custom profile presets; configurable presentation and navigation.
- Versioned strict JSON validation plus actionable cross-field errors, warnings and preview.
- Single choice, multiple select with explicit exact/partial rules, numeric precision and tolerances, fractional/negative marking and configured qualification.
- Overall and optional independent section clocks, section locks/automatic advancement, tab-suspension catch-up, refresh recovery and duplicate-finalization protection.
- Accessible options, six palette statuses, dialog focus handling, keyboard controls, responsive desktop/tablet/mobile layouts, optional full screen and calculator.
- Immutable randomized attempt snapshots, candidate preferences, autosave/error/retry state and browser-storage error reporting.
- Exam import/edit/replace/duplicate/export/delete; independent permanent attempt history, result breakdown, scoreboard and performance statistics.
- Safe plain text/math/raster media, no execution of imported HTML; no remote media during an exam.
- Production service worker and manifest for offline reuse after the first successful cache. All runtime fonts/assets are local.

## Configuration format

See the complete [format reference](public/FORMAT.md) and [JSON Schema](public/exam.schema.json). Generate the schema after changing validation with:

```bash
npm run schema
```

Required exam semantics are never inferred: answer keys, marks, negative marking, overall time, a pass threshold and explicit expiry behavior for timed sections. `autosave` and `autoSubmitOnTimeExpiry` are among the configuration values that require explicit handling.

## Architecture

```text
src/engine/schema.ts       Versioned shape + semantic validation
src/engine/profiles.ts     Reusable presentation/behavior presets
src/engine/attempt.ts      Pure transitions, ordering, deadlines, finalization
src/engine/scoring.ts      Deterministic marking and qualification
src/engine/storage.ts      Versioned IndexedDB, transactions, backup validation
src/engine/calculator.ts   Bounded non-evaluating arithmetic parser
src/engine/types.ts        Persisted attempts and result types
src/components/           Safe math/text, accessible dialogs, calculator
src/pages/                Dashboard/library, import, instructions, live exam,
                          results, scoreboard and settings
src/App.tsx               Workspace coordination, write queue and recovery
public/                   Offline examples, schema, documentation, icon
src/**/*.test.*           Unit, persistence and component safety tests
tests/                    Production-browser integration tests
```

Database `examdesk-local`, version 2: `exams`, `attempts` (index `by-status`), `settings`. Upgrading v1 adds the status index without deleting records. Finalization writes one attempt record in a single transaction and records several snapshots for results and score review.

## Offline and reliability boundaries

- Service workers are enabled in the **production build**, not Vite dev. Load online once, wait for caching, then reopen on the same origin/browser. Updates wait for old application sessions to close before a new one is activated.
- No browser can run application code while closed or indefinitely suspended. On return, overdue attempts finalize immediately using their original effective deadline. No time is reset; closed-browser attempts cannot be re-opened without any new scheduler state.
- An offline simulator trusts the device clock. It cannot provide tamper-proof time, secure answer-key secrecy or proctoring. Active views do not render keys; local JSON, database snapshots and full export records can preserve them.
- IndexedDB is transactional, but sudden process/device failure before a write finishes can lose the latest in-flight change. The UI reports saving/saved/error, retries a failed save without discarding prior known-good state, and keeps a backup manifest for recovery.
- Backups are plain JSON and may contain sensitive candidate/question data. Store them appropriately. Restore never overwrites an existing ID and skips archived active attempts. Export attempt JSON is sanitized for history and review.
- Optional PWA installation depends on the browser; offline caching works without installation. Safari/private mode and browser eviction policies can limit storage. Request persistent storage and keep enough space for local data.

## License

MIT — see [LICENSE](LICENSE).
