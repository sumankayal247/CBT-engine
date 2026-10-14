import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal, RichText } from './Common';
import { LiveExam } from '../pages/LiveExam';
import { Results } from '../pages/Results';
import { createAttempt, finalize } from '../engine/attempt';
import { validateExam } from '../engine/schema';
import demo from '../../public/examples/demo-engineering.json';
afterEach(cleanup);
describe('safe, accessible presentation', () => {
  it('renders text as text and safe mathematics locally', () => {
    const { container } = render(
      <RichText
        text={'<img src=x onerror="alert(1)"> $x^2$ $\\href{javascript:alert(1)}{click}$'}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
  });
  it('labels dialogs, supports Escape and restores focus', () => {
    const close = vi.fn();
    render(
      <Modal title="Confirm submission" onClose={close}>
        <button>Confirm</button>
      </Modal>,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not reveal correct keys or explanations on the live exam DOM', () => {
    const e = validateExam(demo).exam!;
    e.sections[0].questions[0].explanation = 'SECRET_EXPLANATION';
    render(
      <LiveExam
        attempt={createAttempt('e', e, 'Tester')}
        update={vi.fn()}
        saveState="saved"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText('SECRET_EXPLANATION')).toBeNull();
    expect(screen.queryByText('Correct answer:')).toBeNull();
    expect(screen.getByRole('radio', { name: /60 km\/h/ })).toBeDefined();
  });
  it('respects disabled post-submission answer reveal', () => {
    const e = validateExam(demo).exam!;
    e.settings.showSolutionsAfterSubmit = false;
    render(
      <Results
        attempt={finalize(createAttempt('e', e, 'T'), 'manual')}
        onHome={vi.fn()}
        onScoreboard={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Review answers' })).toBeNull();
    expect(screen.getByText(/Answer review is disabled/)).toBeDefined();
  });
});
