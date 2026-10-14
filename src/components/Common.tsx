import { useEffect, useRef, type ReactNode } from 'react';
import katex from 'katex';
import { X, Check, Circle, Flag, LockKeyhole } from 'lucide-react';
import type { QuestionStatus } from '../engine/attempt';
export function RichText({ text }: { text: string }) {
  const pieces = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return (
    <span className="rich-text">
      {pieces.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const display = part.startsWith('$$');
          try {
            return (
              <span
                key={i}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(part.slice(display ? 2 : 1, display ? -2 : -1), {
                    displayMode: display,
                    throwOnError: false,
                    trust: false,
                    strict: 'error',
                    maxExpand: 100,
                    maxSize: 20,
                    output: 'htmlAndMathml',
                  }),
                }}
              />
            );
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, []);
  return (
    <div className="dialog-backdrop">
      <div
        ref={ref}
        className="dialog card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="btn btn-light icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
export const statusLabels: Record<QuestionStatus, string> = {
  'not-visited': 'Not visited',
  unanswered: 'Not answered',
  answered: 'Answered',
  review: 'Marked for review',
  'answered-review': 'Answered & review',
  locked: 'Locked',
};
export function StatusIcon({ status }: { status: QuestionStatus }) {
  return status === 'answered' ? (
    <Check size={13} />
  ) : status === 'review' || status === 'answered-review' ? (
    <Flag size={12} />
  ) : status === 'locked' ? (
    <LockKeyhole size={12} />
  ) : (
    <Circle size={11} />
  );
}
export function Legend() {
  return (
    <div className="status-legend">
      {Object.entries(statusLabels).map(([status, label]) => (
        <div key={status}>
          <span className={`status-chip ${status}`}>
            <StatusIcon status={status as QuestionStatus} />
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">↗</div>
      <h3>{title}</h3>
      <div className="text-secondary">{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="d-flex justify-content-between">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function dateTime(n: number) {
  return new Date(n).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
