import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../storage/storage';
import { createFavouritesStore, orderFavourites, type Favourite } from './favourites';

function memoryStorage(): KeyValueStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const xqc = { slug: 'xqc', name: 'xQc', avatarUrl: 'https://files.kick.com/xqc.webp' };

describe('Favourites store', () => {
  it('adds a Favourite with a Watch Count of 0, and the same toggle removes it', () => {
    let now = 1000;
    const store = createFavouritesStore(memoryStorage(), () => now);
    expect(store.toggle(xqc)).toBe(true);
    expect(store.list()).toEqual([{ ...xqc, addedAt: 1000, watchCount: 0 }]);
    expect(store.has('xqc')).toBe(true);

    now = 2000;
    expect(store.toggle(xqc)).toBe(false);
    expect(store.list()).toEqual([]);
    expect(store.has('xqc')).toBe(false);
  });

  it('counts a watch only for a Favourite, and removing it deletes its Watch Count', () => {
    const store = createFavouritesStore(memoryStorage(), () => 1000);
    store.recordWatch('xqc');
    store.toggle(xqc);
    store.recordWatch('xqc');
    store.recordWatch('xqc');
    store.recordWatch('someone-else');
    expect(store.list()).toEqual([{ ...xqc, addedAt: 1000, watchCount: 2 }]);

    store.toggle(xqc);
    store.toggle(xqc);
    expect(store.list()[0].watchCount).toBe(0);
  });

  it('keeps Favourites and Watch Counts across a restart', () => {
    const storage = memoryStorage();
    const first = createFavouritesStore(storage, () => 1000);
    first.toggle(xqc);
    first.recordWatch('xqc');
    expect(createFavouritesStore(storage).list()).toEqual([{ ...xqc, addedAt: 1000, watchCount: 1 }]);
  });

  it('drops stored entries that are not Favourites, and starts empty on corrupt storage', () => {
    const storage = memoryStorage();
    storage.data['kick.favourites'] = JSON.stringify([
      { ...xqc, addedAt: 5, watchCount: 3 },
      { slug: 'no-count', name: 'x', avatarUrl: '', addedAt: 5 },
      null,
      'text',
    ]);
    expect(createFavouritesStore(storage).list()).toEqual([{ ...xqc, addedAt: 5, watchCount: 3 }]);
    storage.data['kick.favourites'] = '{not json';
    expect(createFavouritesStore(storage).list()).toEqual([]);
  });

  it('still works in memory when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createFavouritesStore(broken, () => 1000);
    expect(store.list()).toEqual([]);
    expect(store.toggle(xqc)).toBe(true);
    store.recordWatch('xqc');
    expect(store.list()).toEqual([{ ...xqc, addedAt: 1000, watchCount: 1 }]);
  });
});

describe('Favourites order', () => {
  function fav(slug: string, watchCount: number, addedAt: number): Favourite {
    return { slug, name: slug, avatarUrl: '', addedAt, watchCount };
  }

  it('puts live Favourites first, then offline; each by Watch Count, highest first; ties newest first', () => {
    const favourites = [
      fav('off-low', 1, 100),
      fav('live-low', 2, 100),
      fav('off-high', 9, 100),
      fav('live-tie-old', 5, 100),
      fav('live-tie-new', 5, 300),
      fav('live-high', 7, 50),
      fav('off-tie-new', 1, 200),
    ];
    const live = ['live-low', 'live-tie-old', 'live-tie-new', 'live-high'];
    const ordered = orderFavourites(favourites, (slug) => live.indexOf(slug) !== -1);
    expect(ordered.map((f) => f.slug)).toEqual([
      'live-high',
      'live-tie-new',
      'live-tie-old',
      'live-low',
      'off-high',
      'off-tie-new',
      'off-low',
    ]);
  });

  it('does not change the list it gets', () => {
    const favourites = [fav('a', 1, 1), fav('b', 2, 1)];
    orderFavourites(favourites, () => false);
    expect(favourites.map((f) => f.slug)).toEqual(['a', 'b']);
  });
});
