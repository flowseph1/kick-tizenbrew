import { PROXY_BASE, type Engine } from './route';

/**
 * AVPlay when the page can reach `webapis.avplay`, else hls.js. TizenBrew module pages may not get
 * `webapis` at all (spike 01 saw it undefined on a remote page), so hls.js is the TV fallback too.
 */
export function pickEngine(win: { webapis?: { avplay?: unknown } }): Engine {
  return win.webapis && win.webapis.avplay ? 'avplay' : 'hlsjs';
}

/** Polls the serviceFile /ping (TizenBrew fetches and starts it after the page opens). */
export function waitForProxy(
  fetchFn: (url: string) => Promise<{ ok: boolean }>,
  tries = 15,
  everyMs = 400,
): Promise<boolean> {
  return new Promise((resolve) => {
    let left = tries;
    function attempt() {
      fetchFn(PROXY_BASE + '/ping').then(
        (r) => (r.ok ? resolve(true) : next()),
        () => next(),
      );
    }
    function next() {
      if (--left <= 0) resolve(false);
      else setTimeout(attempt, everyMs);
    }
    attempt();
  });
}
