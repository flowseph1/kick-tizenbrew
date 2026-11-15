import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; value: T };

/** Runs `load` on mount and on reload(). Late answers from an older run are dropped. */
export function useAsync<T>(load: () => Promise<T>): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const run = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const id = ++run.current;
    setState({ status: 'loading' });
    loadRef.current().then(
      (value) => { if (id === run.current) setState({ status: 'ready', value }); },
      (error) => { if (id === run.current) setState({ status: 'error', error }); },
    );
  }, []);

  useEffect(() => {
    reload();
    return () => { run.current++; };
  }, [reload]);

  return [state, reload];
}
