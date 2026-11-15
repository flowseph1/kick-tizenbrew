// The Viewer's settings, kept on the TV under one localStorage key.
//
// To add a setting, add one entry to `schema`: its default and a check for stored values.
// `Settings` and `set()` pick it up from there. A stored value that fails the check
// (old version, hand edited, corrupt) falls back to the default.
import { readJson, writeJson, type KeyValueStorage } from '../storage/storage';

export type { KeyValueStorage } from '../storage/storage';

export type LanguageChoice = 'auto' | 'en' | 'es';

export const LANGUAGE_CHOICES: LanguageChoice[] = ['auto', 'en', 'es'];

interface Field<T> {
  defaultValue: T;
  isValid(value: unknown): value is T;
}

function oneOf<T extends string>(values: T[]) {
  return (value: unknown): value is T => values.indexOf(value as T) !== -1;
}

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

const schema = {
  language: { defaultValue: 'auto', isValid: oneOf(LANGUAGE_CHOICES) } as Field<LanguageChoice>,
  /** Hides gambling Categories and mature Livestreams (see `src/filter/contentFilter.ts`). */
  contentFilter: { defaultValue: false, isValid: isBoolean } as Field<boolean>,
};

type Schema = typeof schema;
export type Settings = { [K in keyof Schema]: Schema[K] extends Field<infer T> ? T : never };
export type SettingKey = keyof Settings;

export const STORAGE_KEY = 'kick.settings';

export interface SettingsStore {
  get(): Settings;
  set<K extends SettingKey>(key: K, value: Settings[K]): void;
  /** Calls `listener` after each change. Returns the unsubscribe function. */
  subscribe(listener: (settings: Settings) => void): () => void;
}

const keys = Object.keys(schema) as SettingKey[];

function load(storage: KeyValueStorage | null): Settings {
  const stored = readJson(storage, STORAGE_KEY);
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out = {} as Record<string, unknown>;
  for (const k of keys) {
    const field = schema[k] as Field<unknown>;
    out[k] = field.isValid(raw[k]) ? raw[k] : field.defaultValue;
  }
  return out as Settings;
}

export function createSettingsStore(storage: KeyValueStorage | null): SettingsStore {
  let current = load(storage);
  let listeners: Array<(s: Settings) => void> = [];
  return {
    get: () => current,
    set(key, value) {
      if (current[key] === value) return;
      const next = {} as Settings;
      for (const k of keys) (next as Record<string, unknown>)[k] = current[k];
      next[key] = value;
      current = next;
      writeJson(storage, STORAGE_KEY, current);
      listeners.slice().forEach((l) => l(current));
    },
    subscribe(listener) {
      listeners = listeners.concat([listener]);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
}
