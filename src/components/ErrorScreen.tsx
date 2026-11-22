import { useApp } from '../app/context';

/** The shared "Kick API failed" screen. Any screen that loads data can show it. */
/** `detail` is a technical reason in small text (playback), so a TV test can report the cause. */
export function ErrorScreen({ onRetry, detail }: { onRetry: () => void; detail?: string | null }) {
  const { t } = useApp();
  return (
    <div class="error-screen">
      <h1>{t('error.title')}</h1>
      <p>{t('error.body')}</p>
      {detail ? <p class="error-detail">{detail}</p> : null}
      <button class="button" data-focus data-autofocus onClick={onRetry}>
        {t('error.retry')}
      </button>
    </div>
  );
}
