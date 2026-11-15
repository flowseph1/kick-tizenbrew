import { useMemo } from 'preact/hooks';
import { useApp, useScreenActions } from '../app/context';
import { useAsync } from '../app/useAsync';
import { ErrorScreen } from '../components/ErrorScreen';
import { LivestreamTile } from '../components/LivestreamTile';
import { Row } from '../components/Row';
import { createExitGuard, EXIT_WINDOW_MS } from '../nav/exitGuard';

export function Home() {
  const app = useApp();
  const { api, t } = app;
  const [top, reload] = useAsync(() => api.topLivestreams());
  const guard = useMemo(() => createExitGuard(app.now), [app]);

  useScreenActions((action) => {
    if (action !== 'back') {
      guard.reset();
      return false;
    }
    if (guard.press() === 'exit') app.exit();
    else app.toast(t('home.exitHint'), EXIT_WINDOW_MS);
    return true;
  });

  if (top.status === 'error') return <ErrorScreen onRetry={reload} />;

  return (
    <div class="home">
      <header class="top-bar">
        <span class="logo">KICK</span>
        <div class="top-bar-actions">
          <button class="button top-bar-button" data-focus onClick={() => app.push({ name: 'settings' })}>
            {t('home.settings')}
          </button>
        </div>
      </header>
      {top.status === 'loading' ? (
        <p class="status">{t('loading')}</p>
      ) : (
        <Row title={t('home.topLivestreams')}>
          {top.value.length === 0 ? (
            <p class="status">{t('home.empty')}</p>
          ) : (
            top.value.map((ls, i) => <LivestreamTile key={ls.id} livestream={ls} autofocus={i === 0} />)
          )}
        </Row>
      )}
    </div>
  );
}
