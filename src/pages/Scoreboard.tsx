import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Search, Trash2 } from 'lucide-react';
import type { Attempt } from '../engine/types';
import { profileNames } from '../engine/schema';
import { profiles } from '../engine/profiles';
import { dateTime, Empty, Stat } from '../components/Common';
import { round } from '../engine/scoring';
import { download, scoreboardCSV } from '../engine/storage';
export function Scoreboard({
  attempts,
  initialSearch,
  onOpen,
  onDelete,
  onClear,
}: {
  attempts: Attempt[];
  initialSearch: string;
  onOpen: (a: Attempt) => void;
  onDelete: (a: Attempt) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState(initialSearch),
    [profile, setProfile] = useState('all'),
    [status, setStatus] = useState('all'),
    [sort, setSort] = useState('date-desc');
  const completed = attempts.filter((a) => a.result);
  const rows = useMemo(
    () =>
      attempts
        .filter(
          (a) =>
            a.result &&
            a.exam.examName.toLowerCase().includes(search.toLowerCase()) &&
            (profile === 'all' || a.exam.examProfile === profile) &&
            (status === 'all' || a.result.passed === (status === 'pass')),
        )
        .sort((a, b) => {
          if (sort === 'date-asc') return a.completedAt! - b.completedAt!;
          if (sort === 'duration') return a.result!.elapsedSeconds - b.result!.elapsedSeconds;
          if (sort === 'marks') return b.result!.marks - a.result!.marks;
          if (sort === 'percentage') return b.result!.percentage - a.result!.percentage;
          return b.completedAt! - a.completedAt!;
        }),
    [attempts, search, profile, status, sort],
  );
  const average = rows.length
      ? rows.reduce((n, a) => n + a.result!.percentage, 0) / rows.length
      : 0,
    best = rows.length ? Math.max(...rows.map((a) => a.result!.percentage)) : 0;
  const groups = useMemo(() => {
    const groups = new Map<string, Attempt[]>();
    for (const a of rows) {
      const key = a.examId;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return [...groups.values()];
  }, [rows]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PERMANENT LOCAL RECORD</div>
          <h1>The scoreboard</h1>
          <p>Not just a score. A record of how far you’ve come.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={() =>
              download('examdesk-scoreboard.csv', scoreboardCSV(rows), 'text/csv;charset=utf-8')
            }
          >
            <ArrowDownToLine size={16} /> Export CSV
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={() => download('examdesk-attempts.json', rows)}
          >
            Export JSON
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Matching attempts"
          value={rows.length}
          detail={`${completed.length} total saved attempts`}
        />
        <Stat
          label="Best percentage"
          value={rows.length ? `${round(best)}%` : '—'}
          detail="Across the selected records"
        />
        <Stat
          label="Average percentage"
          value={rows.length ? `${round(average)}%` : '—'}
          detail="Across the selected records"
        />
        <Stat
          label="Pass rate"
          value={
            rows.length
              ? `${round((rows.filter((a) => a.result!.passed).length / rows.length) * 100)}%`
              : '—'
          }
          detail="Using each exam’s own criteria"
        />
      </div>
      <section className="card scoreboard-card">
        <div className="scoreboard-filters">
          <div className="search-wrap">
            <Search size={17} />
            <input
              className="form-control"
              aria-label="Search by exam name"
              placeholder="Search examination name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            aria-label="Filter by profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
          >
            <option value="all">All exam profiles</option>
            {profileNames.map((p) => (
              <option value={p} key={p}>
                {profiles[p].label}
              </option>
            ))}
          </select>
          <select
            className="form-select"
            aria-label="Filter by result"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All results</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
          <select
            className="form-select"
            aria-label="Sort attempts"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="duration">Shortest duration</option>
            <option value="marks">Highest marks</option>
            <option value="percentage">Highest percentage</option>
          </select>
        </div>
        {rows.length ? (
          <div className="table-responsive">
            <table className="table scoreboard-table">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Completed</th>
                  <th>Time taken</th>
                  <th>Marks</th>
                  <th>Percentage</th>
                  <th>Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button className="table-name" onClick={() => onOpen(a)}>
                        {a.exam.examName}
                      </button>
                      <small className="d-block text-secondary">
                        {profiles[a.exam.examProfile].label} · {a.candidate}
                      </small>
                    </td>
                    <td>{dateTime(a.completedAt!)}</td>
                    <td className="text-nowrap">
                      {a.result!.timeTaken}
                      <small className="d-block text-secondary">
                        of {a.exam.durationSeconds / 60} min
                      </small>
                    </td>
                    <td>
                      {round(a.result!.marks, a.exam.settings.scorePrecision)} / {a.result!.maximum}
                    </td>
                    <td>
                      <b>{round(a.result!.percentage)}%</b>
                    </td>
                    <td>
                      <span className={`result-pill ${a.result!.passed ? 'pass' : 'fail'}`}>
                        {a.result!.passed ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                    <td className="text-nowrap">
                      <button
                        className="btn icon-button"
                        title="View attempt"
                        aria-label={`View attempt ${a.id}`}
                        onClick={() => onOpen(a)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                      <button
                        className="btn icon-button text-secondary"
                        title="Delete attempt"
                        aria-label={`Delete attempt ${a.id}`}
                        onClick={() => onDelete(a)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No attempts to show">
            <p>
              {completed.length
                ? 'Try changing your search or filters.'
                : 'Complete an examination to begin your performance history.'}
            </p>
          </Empty>
        )}
        <div className="scoreboard-foot">
          <span>{rows.length} records · stored on this device</span>
          <button
            className="btn text-button text-danger"
            disabled={!completed.length}
            onClick={onClear}
          >
            <Trash2 size={14} /> Clear completed history
          </button>
        </div>
      </section>
      {groups.length > 0 && (
        <section className="mt-4">
          <div className="section-heading">
            <h2>Performance by examination</h2>
            <span className="small text-secondary">Based on current filters</span>
          </div>
          <div className="performance-grid">
            {groups.map((group) => {
              const chronological = [...group].sort((a, b) => a.completedAt! - b.completedAt!),
                first = chronological[0],
                last = chronological[chronological.length - 1],
                avg = group.reduce((n, a) => n + a.result!.percentage, 0) / group.length;
              const delta = last.result!.percentage - first.result!.percentage;
              return (
                <article key={first.examId} className="card p-4">
                  <h3>{last.exam.examName}</h3>
                  <p className="text-secondary small">
                    {group.length} attempts · Best{' '}
                    {round(Math.max(...group.map((a) => a.result!.percentage)))}% · Average{' '}
                    {round(avg)}%
                  </p>
                  <div className="trend-bars" aria-label="Percentage history">
                    {chronological.map((a, i) => (
                      <button
                        key={a.id}
                        title={`${dateTime(a.completedAt!)}: ${round(a.result!.percentage)}%`}
                        aria-label={`Attempt ${i + 1}: ${round(a.result!.percentage)} percent`}
                        onClick={() => onOpen(a)}
                      >
                        <span style={{ height: `${Math.max(3, a.result!.percentage)}%` }} />
                      </button>
                    ))}
                  </div>
                  <small>
                    {delta >= 0 ? '+' : ''}
                    {round(delta)} percentage points from first to latest
                  </small>
                  <details className="mt-3">
                    <summary>Section performance & timing</summary>
                    {last.result!.sections.map((s) => {
                      const scores = chronological.flatMap((a) =>
                        a.result!.sections.filter((row) => row.id === s.id),
                      );
                      return (
                        <p className="small mt-2 mb-0" key={s.id}>
                          {s.title}: latest {round(s.percentage)}%, average{' '}
                          {round(scores.reduce((n, r) => n + r.percentage, 0) / scores.length)}%,
                          first {round(scores[0].percentage)}%
                        </p>
                      );
                    })}
                    <p className="small mt-2 mb-0">
                      Average time:{' '}
                      {round(
                        group.reduce((n, a) => n + a.result!.elapsedSeconds, 0) / group.length / 60,
                        1,
                      )}{' '}
                      min · Average accuracy:{' '}
                      {round(group.reduce((n, a) => n + a.result!.accuracy, 0) / group.length)}%
                    </p>
                    <small className="text-secondary">
                      Configuration changes can affect comparability.
                    </small>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
