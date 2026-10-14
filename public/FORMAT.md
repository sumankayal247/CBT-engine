# ExamDesk examination JSON · version 1.0

This is a **practice format**, not an official marking scheme. Import a UTF-8 `.json` file (up to 10 MB) in **Import examination**. Drag/drop, file selection and a JSON editor are supported. The application never invents a duration, answer key, question marks, negative marking or overall pass threshold. Missing required values block saving until you provide them.

Download `examples/demo-engineering.json` for a working paper containing all three question types. `examples/railway-practice.json` is a second, untimed-section example. `exam.schema.json` is the generated JSON Schema (draft 2020-12). The runtime validator additionally checks cross-field relationships: unique IDs, valid answer references, attainable thresholds and partial-credit totals. Unknown fields are rejected to catch typos.

## Top-level fields

| Field             | Type    | Meaning                                                                                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`   | string  | Required, exactly `"1.0"`.                                                                                                          |
| `examId`          | string  | Optional source identifier. Duplicate source IDs trigger a warning/confirmation; they never overwrite a local record automatically. |
| `examName`        | string  | Required nonempty name, up to 200 characters.                                                                                       |
| `examCode`        | string  | Optional short identifier, up to 80 characters.                                                                                     |
| `examProfile`     | enum    | `ncbt-style`, `railway`, `jee-style`, `gate-style`, `nta-style`, `generic`, or `custom`. All use the same scoring engine.           |
| `description`     | string  | Optional description, up to 5,000 characters.                                                                                       |
| `language`        | string  | Required content language tag, e.g. `en` or `hi`. Sets the question area's language, not a translation of the application UI.       |
| `durationSeconds` | integer | Required positive overall duration, at most 604800 seconds (7 days).                                                                |
| `totalMarks`      | number  | Optional declared maximum. A mismatch is a warning; calculated marks always govern scoring.                                         |
| `passCriteria`    | object  | Required; see qualification below.                                                                                                  |
| `settings`        | object  | Optional; defaults below.                                                                                                           |
| `sections`        | array   | 1–50 sections, each containing 1–1000 questions.                                                                                    |

IDs (`examId`, section, question and option IDs) use letters, digits, underscores and hyphens, with a maximum length of 100. Reserved IDs `__proto__`, `constructor` and `prototype` are rejected. Section IDs are unique in the exam; question IDs are unique across **all** sections; option IDs are unique within a question. The local library ID is a separate UUID generated at import.

## Qualification

```json
"passCriteria": {
  "minimumMarks": 40,
  "minimumPercentage": 50,
  "requireAllSectionMinimums": true
}
```

At least one overall threshold is required. If both are given, **both must be met**. No universal passing percentage is assumed. With `requireAllSectionMinimums: true`, all configured section thresholds must also be met. A section with no threshold adds no restriction. If `false` (default), section qualification is still reported but does not affect the overall result. All mark thresholds must be nonnegative and no greater than their calculated maximum; percentages are 0–100.

## Settings and editable profiles

| Field                      | Default               | Behavior                                                                                                                                                                    |
| -------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowSectionNavigation`   | `true`                | Free movement among unlocked sections. If false, use Continue to next section; this permanently locks the previous section and requires confirmation.                       |
| `allowQuestionNavigation`  | Profile default: true | Direct palette jumps. If false, only current/adjacent available questions are selectable.                                                                                   |
| `allowPrevious`            | Profile default: true | Allows backward movement within a section.                                                                                                                                  |
| `allowReview`              | Profile default: true | Enables review marking, independent of scoring.                                                                                                                             |
| `shuffleQuestions`         | `false`               | Fisher–Yates shuffle within each section at attempt creation.                                                                                                               |
| `shuffleOptions`           | `false`               | Shuffle choice display order. IDs and answer keys are unchanged. Do not use for position-dependent options such as “all of the above”.                                      |
| `allowCalculator`          | `false`               | Shows a safe arithmetic/scientific calculator. Supports `+ - * / ^`, parentheses, sqrt, sin/cos/tan in radians, log (base 10), ln, abs, pi and e. No JavaScript evaluation. |
| `showSolutionsAfterSubmit` | `true`                | Enables answer-by-answer review only after completion. When false, correct keys and explanations are absent from result/review views.                                       |
| `autosave`                 | `true`                | Must be true. Reliable immediate response persistence is mandatory in this engine.                                                                                          |
| `autoSubmitOnTimeExpiry`   | `true`                | Must be true. Disabling deadline enforcement is not supported.                                                                                                              |
| `sectionExpiry`            | No default            | **Required when any section has a timer.** `advance` or `lock`; see timing below.                                                                                           |
| `scorePrecision`           | `2`                   | Display rounding, integer 0–8. Raw question and aggregate scores are retained.                                                                                              |
| `warningSeconds`           | `[300,60]`            | Positive thresholds; countdown is highlighted once the earliest warning is reached.                                                                                         |
| `presentation`             | Profile defaults      | Optional `palettePosition` (`left` or `right`), `accent` (`#RRGGBB`), `showCandidate` (boolean), `compactOptions` (boolean).                                                |

The setup form edits name, duration, profile, pass criteria, navigation, randomization, calculator, reveal policy, display rounding and layout. Individual section timers, thresholds and navigation overrides also have setup fields. All supported values are editable in the in-app JSON editor with immediate validation. Presets supply presentation/interaction defaults only, never official marking rules. Railway uses compact options; Custom uses a left palette by default. You can override either.

All responses persist on selection/valid numeric entry, not just on Save & Next. This implementation deliberately supports immediate-save interaction; no deferred-save mode silently discards a selected response.

## Sections

```json
{
  "id": "mathematics",
  "title": "Mathematics",
  "order": 2,
  "durationSeconds": 1800,
  "minimumMarksToPass": 10,
  "minimumPercentageToPass": 30,
  "settings": {
    "allowQuestionNavigation": true,
    "allowPrevious": true,
    "allowReview": true
  },
  "questions": []
}
```

`id`, `title`, `order` and a **nonempty** `questions` array are required. The empty array above is illustrative, not importable. `order` is a unique nonnegative integer; sections are sorted by it when starting. Section settings override the matching examination/profile behavior. Section timers and qualification thresholds are optional.

### Timing contract

- Creating an attempt establishes immutable `startedAt` and `deadline = startedAt + durationSeconds × 1000` timestamps. Instructions do not create an attempt or start a clock.
- A section's clock starts on **first entry**. It runs continuously, including while another section is selected, the tab is suspended or the browser is closed. Reentry never resets it. Untimed sections use the overall deadline.
- `sectionExpiry: "advance"`: expired sections lock; if the current section expires, the next unlocked section (later order first, wrapping when necessary) starts at the expired section's original deadline. Multiple expired timers catch up on return, without extra time.
- `sectionExpiry: "lock"`: expired sections lock; the next available section starts when the application processes the expiry/you return to it, still capped by the original overall deadline.
- A section already entered retains its original deadline under either policy. When every section is locked, the attempt finalizes. If the overall deadline is reached first, it finalizes there.
- All answer and navigation actions check deadlines before applying changes. Manual and timeout submission use the same deterministic scorer and idempotent IndexedDB finalization.
- A browser cannot execute JavaScript while fully closed or forcibly suspended. Deadlines remain authoritative; an overdue attempt is finalized immediately on wake/reopen, with its effective completion timestamp capped at the applicable deadline—not the reopening time. There is no background-server claim.
- The offline engine relies on the device wall clock and is not tamper-proof against changing that clock, developer tools or local database edits.

## Question fields

All questions require `id`, `type`, nonempty `questionText`, **positive** `marks`, and **nonnegative** `negativeMarks`. Fractional values are supported (finite values up to 1,000,000). `explanation` is optional. Unanswered always scores zero. Review marking never changes scoring.

### Single choice

```json
{
  "id": "q1",
  "type": "single-choice",
  "questionText": "What is 2 + 2?",
  "marks": 2,
  "negativeMarks": 0.5,
  "options": [
    { "id": "A", "text": "3" },
    { "id": "B", "text": "4" }
  ],
  "correctOptionIds": ["B"],
  "explanation": "Two pairs make four."
}
```

2–20 options, each with unique `id` and nonempty `text`. Exactly one existing `correctOptionIds` entry. True/false can be represented by two options. Correct = `marks`; incorrect = `-negativeMarks`.

### Multiple select

Use `type: "multiple-select"`, the same options structure, one or more unique correct IDs, and a **required explicit** scoring object:

```json
"scoring": {"mode":"exact"}
```

Exact match awards full marks only for the complete correct set with no incorrect selections. All other nonempty responses receive `-negativeMarks`.

Alternatively:

```json
"scoring": {
  "mode": "partial",
  "perCorrectOption": 1,
  "incorrectSelectionPenalty": 1
}
```

For partial mode, `perCorrectOption × number of correct options` must equal question marks. Empty = 0; exact correct set = full marks. Otherwise the score is:

```
min(marks, max(-negativeMarks,
    selectedCorrectCount * perCorrectOption
  - selectedIncorrectCount * incorrectSelectionPenalty))
```

`perCorrectOption` is positive; penalty is nonnegative. This is one explicit, documented partial-credit rule—not an inference about any official exam. Partial outcomes mean positive credit short of an exact match. A zero/negative nonempty incorrect response is counted as incorrect. `correct + partial + incorrect = attempted`. Accuracy is fully correct / attempted × 100. Reported negative deduction sums net negative question scores, not internal penalties already offset by partial credit.

### Numerical

```json
{
  "id": "q2",
  "type": "numerical",
  "questionText": "Evaluate $\\sqrt{2}$.",
  "marks": 2,
  "negativeMarks": 0,
  "correctAnswer": 1.41,
  "decimalPrecision": 2,
  "absoluteTolerance": 0.005,
  "relativeTolerance": 0
}
```

`correctAnswer` is a required finite number. No `options` or `correctOptionIds` are allowed. Optional `decimalPrecision` is 0–12; omitted means no decimal-place restriction. Input accepts signed decimals (including 0), not scientific notation or units. Invalid/incomplete numeric entry is visibly flagged and is **not saved**; the last valid saved response remains until a valid entry or Clear Response. Navigation and manual submission are blocked until corrected, but clocks continue.

Tolerances default to zero. `absoluteTolerance` is nonnegative; `relativeTolerance` is a fraction in 0–1. An answer is correct when:

```
abs(response - correctAnswer) <= max(absoluteTolerance,
                                  abs(correctAnswer) * relativeTolerance)
```

A very small floating-point epsilon handles representational boundary error. Question scores are not rounded before accumulation. Qualification uses unrounded totals with a 1e-9 boundary epsilon; configured rounding is for display only.

## Content and safety

Plain text and line breaks are rendered as text. Inline math uses `$...$`, display math `$$...$$`; escape backslashes for JSON (`\\frac{a}{b}`). KaTeX is bundled locally with `trust: false`, strict parsing and bounded expansion. Use mathematical notation for super/subscripts. Imported HTML/JavaScript is **never executed**; HTML tags display as text.

Optional raster image:

```json
"image": {"src":"data:image/png;base64,...", "alt":"Description of the diagram"}
```

Only inline base64 PNG, JPEG and WebP are accepted (source length ≤2,000,000 characters). Actual valid base64 is required, not the ellipsis above. External URLs and SVG are rejected to preserve privacy and offline behavior. Audio/video and arbitrary rich HTML are not part of v1.0.

## Attempts, backups and privacy

An attempt stores its UUID, local exam ID, complete immutable configuration (including randomized order), candidate, original start/deadline, first-entry section times, locked sections, current question, responses, visited/review flags and monotonically increasing revision. A completed attempt adds reason, completion timestamp and deterministic result: raw marks, maximum, percentage, pass/fail, elapsed seconds, formatted duration, question/section outcomes and counts.

Exports: exam JSON, CSV of filtered scoreboard records, JSON of filtered full attempts, individual full attempt JSON, and a **restorable full backup** from Settings & data. CSV spreadsheet-formula prefixes are escaped. Only the full backup envelope is accepted by Restore:

```json
{ "format": "examdesk-backup", "version": 1, "exportedAt": 0, "exams": [], "attempts": [] }
```

Restore validates the complete file (up to 50 MB), rejects duplicate IDs and inconsistent records, and recalculates completed results. It merges transactionally without overwriting existing IDs. Active attempts are included in a backup for archival purposes but **skipped on restore**, so restoring cannot resurrect or extend an examination. Preference settings are device-specific and excluded. Removing an exam does not delete history.

Answer keys are not rendered during a live attempt, and management/export views are inaccessible until it finishes or is discarded. However, this is an offline practice app: imported files, local IndexedDB and full exports necessarily contain answer keys. Reveal policy is a presentation policy, not cryptographic protection or secure proctoring.
