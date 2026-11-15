// Home's Back key rule: the first press shows a hint, a second press within the window exits.

export const EXIT_WINDOW_MS = 2000;

export interface ExitGuard {
  press(): 'hint' | 'exit';
  reset(): void;
}

export function createExitGuard(now: () => number = Date.now, windowMs: number = EXIT_WINDOW_MS): ExitGuard {
  let lastPress: number | null = null;
  return {
    press() {
      const t = now();
      if (lastPress !== null && t - lastPress <= windowMs) {
        lastPress = null;
        return 'exit';
      }
      lastPress = t;
      return 'hint';
    },
    reset() {
      lastPress = null;
    },
  };
}
