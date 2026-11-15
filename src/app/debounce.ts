export interface Debounce<T> {
  /** Restarts the wait; `run` gets the value of the last call. */
  call(value: T): void;
  cancel(): void;
}

/** Runs `run` once, `ms` after the last call. Search uses it so each key press does not hit Kick. */
export function createDebounce<T>(ms: number, run: (value: T) => void): Debounce<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call(value) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        run(value);
      }, ms);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
