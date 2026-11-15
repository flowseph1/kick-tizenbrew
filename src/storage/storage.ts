// Wrapped `localStorage`. The Module must keep running when storage is missing, blocked or full,
// so every access goes through here and a failure only means "not saved".

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null when reading it throws (some sandboxes do). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (e) {
    return null;
  }
}

/** Reads and parses a JSON value. Returns undefined when it is missing, corrupt or unreadable. */
export function readJson(storage: KeyValueStorage | null, key: string): unknown {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

/** Saves a JSON value. Returns false when storage refused it. */
export function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}
