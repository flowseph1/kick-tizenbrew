import { describe, expect, it } from 'vitest';
import { createExitGuard } from './exitGuard';

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('exit guard', () => {
  it('asks for a second press the first time', () => {
    const c = clock();
    const guard = createExitGuard(c.now);
    expect(guard.press()).toBe('hint');
  });

  it('exits on a second press within 2 s', () => {
    const c = clock();
    const guard = createExitGuard(c.now);
    guard.press();
    c.advance(1999);
    expect(guard.press()).toBe('exit');
  });

  it('asks again when the second press comes after 2 s', () => {
    const c = clock();
    const guard = createExitGuard(c.now);
    guard.press();
    c.advance(2001);
    expect(guard.press()).toBe('hint');
    c.advance(500);
    expect(guard.press()).toBe('exit');
  });

  it('starts over after a reset', () => {
    const c = clock();
    const guard = createExitGuard(c.now);
    guard.press();
    guard.reset();
    expect(guard.press()).toBe('hint');
  });
});
