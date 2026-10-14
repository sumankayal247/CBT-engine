import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from './App';
it('acquires a single writer lock without self-contention under React StrictMode', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const request = vi.fn(
    (_name: string, _options: object, callback: (lock: object | null) => Promise<void>) =>
      callback({ name: 'examdesk-single-writer' }),
  );
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  try {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(await screen.findByRole('heading', { name: 'Practice with purpose.' })).toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ExamDesk is open in another tab')).toBeNull();
  } finally {
    cleanup();
    if (descriptor) Object.defineProperty(navigator, 'locks', descriptor);
    else Reflect.deleteProperty(navigator, 'locks');
  }
});
