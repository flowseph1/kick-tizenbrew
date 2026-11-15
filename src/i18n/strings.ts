// All UI text. Add a key to `en` and the same key to every other table (`es`);
// the string table test fails until every language has every key with the same {placeholders}.
// Add a language by adding a table typed as `Strings`, listing it in `tables` and in `Language`.
import type { LanguageChoice } from '../settings/settings';

const en = {
  'app.notAffiliated': 'Not affiliated with Kick',
  'home.topLivestreams': 'Top Livestreams',
  'home.empty': 'No Livestreams right now',
  'home.exitHint': 'Press Back again to exit',
  'home.settings': 'Settings',
  'tile.viewers': '{count} viewers',
  'loading': 'Loading',
  'error.title': 'Could not reach Kick',
  'error.body': 'Check the TV network connection and try again.',
  'error.retry': 'Retry',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.language.auto': 'Auto',
  'settings.language.en': 'English',
  'settings.language.es': 'Español',
  'settings.version': 'Version {version}',
};

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;
export type Language = 'en' | 'es';

const es: Strings = {
  'app.notAffiliated': 'No afiliado a Kick',
  'home.topLivestreams': 'Directos más vistos',
  'home.empty': 'No hay directos ahora',
  'home.exitHint': 'Pulsa Atrás otra vez para salir',
  'home.settings': 'Ajustes',
  'tile.viewers': '{count} espectadores',
  'loading': 'Cargando',
  'error.title': 'No se pudo conectar con Kick',
  'error.body': 'Revisa la conexión de red del televisor e inténtalo de nuevo.',
  'error.retry': 'Reintentar',
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.language.auto': 'Automático',
  // Language names stay in their own language so a Viewer can always find theirs.
  'settings.language.en': 'English',
  'settings.language.es': 'Español',
  'settings.version': 'Versión {version}',
};

export const tables: Record<Language, Strings> = { en, es };
export const languages = Object.keys(tables) as Language[];

/** Auto follows the TV language (for example `es-ES`) when we have it, else English. */
export function resolveLanguage(choice: LanguageChoice, tvLanguage: string): Language {
  if (choice !== 'auto') return choice;
  const base = (tvLanguage || '').toLowerCase().split(/[-_]/)[0];
  return languages.indexOf(base as Language) !== -1 ? (base as Language) : 'en';
}

export type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

export function createTranslator(lang: string): Translate {
  const table: Strings = (tables as Record<string, Strings>)[lang] || tables.en;
  return (key, values) => {
    const text = table[key] || tables.en[key] || key;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m));
  };
}
