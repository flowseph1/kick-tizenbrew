import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebounce } from './debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createDebounce', () => {
  it('runs 400 ms after the last call, with the last value', () => {
    const run = vi.fn<(word: string) => void>();
    const d = createDebounce(400, run);

    d.call('x');
    vi.advanceTimersByTime(300);
    d.call('xq');
    vi.advanceTimersByTime(300);
    d.call('xqc');
    vi.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('xqc');
  });

  it('does not run after cancel', () => {
    const run = vi.fn<(word: string) => void>();
    const d = createDebounce(400, run);

    d.call('xqc');
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });
});
