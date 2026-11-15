// All UI text. Add a language by adding a table typed as `Strings` and listing it in `tables`.
// Ticket 10 adds `es` and the Auto (TV language) setting.

const en = {
  'app.notAffiliated': 'Not affiliated with Kick',
  'home.topLivestreams': 'Top Livestreams',
  'home.empty': 'No Livestreams right now',
  'home.exitHint': 'Press Back again to exit',
  'home.categories': 'Categories',
  'category.empty': 'No Livestreams in this Category right now',
  'tile.viewers': '{count} viewers',
  'loading': 'Loading',
  'error.title': 'Could not reach Kick',
  'error.body': 'Check the TV network connection and try again.',
  'error.retry': 'Retry',
};

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;
export type Language = 'en';

export const tables: Record<Language, Strings> = { en };
export const languages = Object.keys(tables) as Language[];

export type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

export function createTranslator(lang: string): Translate {
  const table: Strings = (tables as Record<string, Strings>)[lang] || tables.en;
  return (key, values) => {
    const text = table[key] || tables.en[key] || key;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m));
  };
}
