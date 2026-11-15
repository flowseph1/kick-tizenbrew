import { describe, expect, it } from 'vitest';
import { createTranslator, languages, tables } from './strings';

describe('string table', () => {
  it('returns the English text for a key', () => {
    const t = createTranslator('en');
    expect(t('home.exitHint')).toBe('Press Back again to exit');
  });

  it('fills in named values', () => {
    const t = createTranslator('en');
    expect(t('tile.viewers', { count: '1,234' })).toBe('1,234 viewers');
  });

  it('falls back to English for an unknown language', () => {
    const t = createTranslator('xx');
    expect(t('error.retry')).toBe('Retry');
  });

  it('has every English key in every language, with text', () => {
    const keys = Object.keys(tables.en).sort();
    for (const lang of languages) {
      const table = tables[lang] as Record<string, string>;
      expect(Object.keys(table).sort()).toEqual(keys);
      for (const k of keys) expect(table[k].trim()).not.toBe('');
    }
  });
});
