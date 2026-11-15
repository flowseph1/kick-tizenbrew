import { version } from '../../package.json';
import { useApp } from '../app/context';
import type { StringKey } from '../i18n/strings';
import { LANGUAGE_CHOICES, type LanguageChoice } from '../settings/settings';

const LANGUAGE_LABELS: Record<LanguageChoice, StringKey> = {
  auto: 'settings.language.auto',
  en: 'settings.language.en',
  es: 'settings.language.es',
};

/**
 * Settings: one `settings-row` per setting, then the Module version and the disclaimer.
 * Back returns to Home through the App's default.
 */
export function SettingsScreen() {
  const { t, settings, setSetting } = useApp();
  return (
    <div class="settings">
      <h1 class="screen-title">{t('settings.title')}</h1>

      <section class="settings-row">
        <h2 class="settings-label">{t('settings.language')}</h2>
        <div class="settings-options">
          {LANGUAGE_CHOICES.map((choice) => {
            const selected = settings.language === choice;
            return (
              <button
                key={choice}
                class={'button option' + (selected ? ' selected' : '')}
                data-focus
                data-autofocus={selected ? true : undefined}
                aria-pressed={selected ? 'true' : 'false'}
                onClick={() => setSetting('language', choice)}
              >
                {t(LANGUAGE_LABELS[choice])}
              </button>
            );
          })}
        </div>
      </section>

      <footer class="settings-about">
        <p>{t('settings.version', { version })}</p>
        <p>{t('app.notAffiliated')}</p>
      </footer>
    </div>
  );
}
