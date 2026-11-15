import { useApp } from '../app/context';

/** The shared "Kick API failed" screen. Any screen that loads data can show it. */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useApp();
  return (
    <div class="error-screen">
      <h1>{t('error.title')}</h1>
      <p>{t('error.body')}</p>
      <button class="button" data-focus data-autofocus onClick={onRetry}>
        {t('error.retry')}
      </button>
    </div>
  );
}
