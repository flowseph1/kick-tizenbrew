import { useEffect, useRef, useState } from 'preact/hooks';
import type { Livestream } from '../api/types';
import { useApp } from '../app/context';
import type { Favourite } from './favourites';

/** Live status of the Favourites refreshes this often while Home is visible. */
export const FAVOURITES_REFRESH_MS = 60000;

/** Per Channel slug: its Livestream when live, null when offline. A slug not checked yet is missing. */
export type LiveStatus = { [slug: string]: Livestream | null };

/**
 * Asks Kick which Favourites are live, now and every 60 s while the calling screen is mounted.
 * A Channel that fails to load counts as offline. Never filtered by the Content Filter.
 * `ready` turns true once the first check has an answer for every Favourite, so the row
 * shows (and takes focus) in its real order.
 */
export function useFavouritesLive(favourites: Favourite[]): { live: LiveStatus; ready: boolean } {
  const { api } = useApp();
  const [live, setLive] = useState<LiveStatus>({});
  const [ready, setReady] = useState(false);
  const run = useRef(0);
  const slugs = favourites.map((f) => f.slug).join('\n');

  useEffect(() => {
    if (!slugs) return;
    const list = slugs.split('\n');
    function check() {
      const id = ++run.current;
      let pending = list.length;
      list.forEach((slug) => {
        const done = (ls: Livestream | null) => {
          if (id !== run.current) return;
          setLive((prev) => {
            const next: LiveStatus = {};
            Object.keys(prev).forEach((k) => (next[k] = prev[k]));
            next[slug] = ls;
            return next;
          });
          if (--pending === 0) setReady(true);
        };
        api.channelLivestream(slug).then(done, () => done(null));
      });
    }
    check();
    const timer = setInterval(check, FAVOURITES_REFRESH_MS);
    return () => {
      clearInterval(timer);
      run.current++;
    };
  }, [api, slugs]);

  return { live, ready };
}
