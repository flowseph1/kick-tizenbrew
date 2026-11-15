import { describe, expect, it } from 'vitest';
import { createSettingsStore, type KeyValueStorage } from './settings';

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

const broken: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('settings store', () => {
  it('starts with Language Auto', () => {
    expect(createSettingsStore(memoryStorage()).get().language).toBe('auto');
  });

  it('keeps a change across a restart', () => {
    const storage = memoryStorage();
    createSettingsStore(storage).set('language', 'es');
    expect(createSettingsStore(storage).get().language).toBe('es');
  });

  it('tells subscribers about a change', () => {
    const store = createSettingsStore(memoryStorage());
    const seen: string[] = [];
    const off = store.subscribe((s) => seen.push(s.language));
    store.set('language', 'en');
    off();
    store.set('language', 'es');
    expect(seen).toEqual(['en']);
  });

  it('still works in memory when storage throws', () => {
    const store = createSettingsStore(broken);
    expect(store.get().language).toBe('auto');
    store.set('language', 'es');
    expect(store.get().language).toBe('es');
  });

  it('still works when there is no storage at all', () => {
    const store = createSettingsStore(null);
    store.set('language', 'en');
    expect(store.get().language).toBe('en');
  });

  it('ignores stored values that are corrupt or not allowed', () => {
    const storage = memoryStorage();
    storage.data['kick.settings'] = '{not json';
    expect(createSettingsStore(storage).get().language).toBe('auto');
    storage.data['kick.settings'] = JSON.stringify({ language: 'fr', extra: 1 });
    expect(createSettingsStore(storage).get()).toEqual({ language: 'auto', contentFilter: false });
  });

  it('starts with the Content Filter off, and keeps it on across a restart', () => {
    const storage = memoryStorage();
    expect(createSettingsStore(storage).get().contentFilter).toBe(false);
    createSettingsStore(storage).set('contentFilter', true);
    expect(createSettingsStore(storage).get().contentFilter).toBe(true);
  });

  it('falls back to the Content Filter off for a stored value that is not true or false', () => {
    const storage = memoryStorage();
    storage.data['kick.settings'] = JSON.stringify({ language: 'es', contentFilter: 'yes' });
    expect(createSettingsStore(storage).get()).toEqual({ language: 'es', contentFilter: false });
  });
});
