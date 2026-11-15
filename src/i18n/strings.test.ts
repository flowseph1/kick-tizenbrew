import { describe, expect, it } from 'vitest';
import { createTranslator, languages, resolveLanguage, tables } from './strings';

describe('language choice', () => {
  it('uses Spanish on a Spanish TV when set to Auto', () => {
    expect(resolveLanguage('auto', 'es-ES')).toBe('es');
    expect(resolveLanguage('auto', 'es_MX')).toBe('es');
    expect(resolveLanguage('auto', 'ES')).toBe('es');
  });

  it('falls back to English for any other TV language, or none', () => {
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'fr-FR')).toBe('en');
    expect(resolveLanguage('auto', '')).toBe('en');
  });

  it('uses the chosen language over the TV language', () => {
    expect(resolveLanguage('en', 'es-ES')).toBe('en');
    expect(resolveLanguage('es', 'en-US')).toBe('es');
  });
});

describe('string table', () => {
  it('returns the Spanish text for a key', () => {
    expect(createTranslator('es')('error.retry')).toBe('Reintentar');
  });

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

  it('has English and Spanish', () => {
    expect(languages.slice().sort()).toEqual(['en', 'es']);
  });

  // Strict: a key added to `en` without its translation (or a stale key left in another
  // language) fails here, so the Spanish UI never silently shows English.
  it('has exactly the English keys in every language, with text', () => {
    const keys = Object.keys(tables.en).sort();
    for (const lang of languages) {
      const table = tables[lang] as Record<string, string>;
      expect({ lang, keys: Object.keys(table).sort() }).toEqual({ lang, keys });
      for (const k of keys) expect({ lang, k, empty: !table[k] || !table[k].trim() }).toEqual({ lang, k, empty: false });
    }
  });

  it('uses the same {placeholders} in every language', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
    for (const lang of languages) {
      const table = tables[lang] as Record<string, string>;
      for (const k of Object.keys(tables.en)) {
        expect({ lang, k, names: names(table[k] || '') }).toEqual({ lang, k, names: names((tables.en as Record<string, string>)[k]) });
      }
    }
  });
});
