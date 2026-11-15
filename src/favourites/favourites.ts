// Favourites and their Watch Count, kept on the TV under one localStorage key.
// Storage goes through `src/storage/storage.ts`, so a storage failure only means "not saved".
// Favourites never go through the Content Filter.
import { readJson, writeJson, type KeyValueStorage } from '../storage/storage';

/** What the Module needs to show a Favourite without asking Kick. */
export interface FavouriteChannel {
  slug: string;
  name: string;
  avatarUrl: string;
}

export interface Favourite extends FavouriteChannel {
  /** When the Viewer added it (ms since 1970). Breaks Watch Count ties: newest first. */
  addedAt: number;
  /** How many times a Livestream of this Channel started to play on this TV. */
  watchCount: number;
}

export const STORAGE_KEY = 'kick.favourites';

export interface FavouritesStore {
  list(): Favourite[];
  has(slug: string): boolean;
  /** Adds the Channel, or removes it (and its Watch Count) when it is a Favourite. Returns true when added. */
  toggle(channel: FavouriteChannel): boolean;
  /** A Livestream of this Channel started to play: its Watch Count goes up by 1 (Favourites only). */
  recordWatch(slug: string): void;
  /** Calls `listener` after each change. Returns the unsubscribe function. */
  subscribe(listener: (favourites: Favourite[]) => void): () => void;
}

/**
 * The Home Favourites row order: live Favourites first, then offline ones.
 * Each group by Watch Count, highest first; ties put the most recently added first.
 */
export function orderFavourites(favourites: Favourite[], isLive: (slug: string) => boolean): Favourite[] {
  return favourites.slice().sort((a, b) => {
    const live = Number(isLive(b.slug)) - Number(isLive(a.slug));
    if (live !== 0) return live;
    if (a.watchCount !== b.watchCount) return b.watchCount - a.watchCount;
    return b.addedAt - a.addedAt;
  });
}

function isFavourite(value: unknown): value is Favourite {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.slug === 'string' &&
    f.slug !== '' &&
    typeof f.name === 'string' &&
    typeof f.avatarUrl === 'string' &&
    typeof f.addedAt === 'number' &&
    typeof f.watchCount === 'number'
  );
}

/** The stored Favourites. Entries that are not Favourites (old version, hand edited, corrupt) are dropped. */
function load(storage: KeyValueStorage | null): Favourite[] {
  const stored = readJson(storage, STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isFavourite).map((f) => ({
    slug: f.slug,
    name: f.name,
    avatarUrl: f.avatarUrl,
    addedAt: f.addedAt,
    watchCount: f.watchCount,
  }));
}

export function createFavouritesStore(storage: KeyValueStorage | null, now: () => number = Date.now): FavouritesStore {
  let current = load(storage);
  let listeners: Array<(f: Favourite[]) => void> = [];

  function save(next: Favourite[]) {
    current = next;
    writeJson(storage, STORAGE_KEY, current);
    listeners.slice().forEach((l) => l(current));
  }

  const store: FavouritesStore = {
    list: () => current,
    has: (slug) => current.some((f) => f.slug === slug),
    toggle(channel) {
      if (store.has(channel.slug)) {
        save(current.filter((f) => f.slug !== channel.slug));
        return false;
      }
      const added: Favourite = {
        slug: channel.slug,
        name: channel.name,
        avatarUrl: channel.avatarUrl,
        addedAt: now(),
        watchCount: 0,
      };
      save(current.concat([added]));
      return true;
    },
    recordWatch(slug) {
      if (!store.has(slug)) return;
      save(current.map((f) => (f.slug === slug ? { ...f, watchCount: f.watchCount + 1 } : f)));
    },
    subscribe(listener) {
      listeners = listeners.concat([listener]);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
  return store;
}
