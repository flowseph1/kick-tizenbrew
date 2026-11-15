import { useMemo } from 'preact/hooks';
import { useApp, useScreenActions } from '../app/context';
import { useOpenLivestream } from '../app/openLivestream';
import { useAsync } from '../app/useAsync';
import { CategoryTile } from '../components/CategoryTile';
import { ErrorScreen } from '../components/ErrorScreen';
import { LivestreamTile } from '../components/LivestreamTile';
import { Row } from '../components/Row';
import { visibleCategories, visibleLivestreams } from '../filter/contentFilter';
import { createExitGuard, EXIT_WINDOW_MS } from '../nav/exitGuard';

export function Home() {
  const app = useApp();
  const { api, t, settings } = app;
  const open = useOpenLivestream();
  const [top, reloadTop] = useAsync(() => api.topLivestreams());
  const [categories, reloadCategories] = useAsync(() => api.topCategories());
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

  if (top.status === 'error' || categories.status === 'error') {
    return (
      <ErrorScreen
        onRetry={() => {
          if (top.status === 'error') reloadTop();
          if (categories.status === 'error') reloadCategories();
        }}
      />
    );
  }

  const filterOn = settings.contentFilter;
  const livestreams = top.status === 'ready' ? visibleLivestreams(top.value, filterOn) : [];
  const shownCategories = categories.status === 'ready' ? visibleCategories(categories.value, filterOn) : [];

  return (
    <div class="home">
      <header class="top-bar">
        <span class="logo">KICK</span>
        <div class="top-bar-actions">
          <button class="button top-bar-button" data-focus onClick={() => app.push({ name: 'search' })}>
            {t('search.title')}
          </button>
          <button class="button top-bar-button" data-focus onClick={() => app.push({ name: 'settings' })}>
            {t('home.settings')}
          </button>
        </div>
      </header>
      {top.status === 'loading' ? (
        <p class="status">{t('loading')}</p>
      ) : (
        <Row title={t('home.topLivestreams')}>
          {livestreams.length === 0 ? (
            <p class="status">{t('home.empty')}</p>
          ) : (
            livestreams.map((ls, i) => (
              <LivestreamTile key={ls.id} livestream={ls} autofocus={i === 0} onSelect={() => open(ls)} />
            ))
          )}
        </Row>
      )}
      {shownCategories.length > 0 ? (
        <Row title={t('home.categories')}>
          {shownCategories.map((c) => (
            <CategoryTile key={c.id} category={c} onSelect={() => app.push({ name: 'category', category: c })} />
          ))}
        </Row>
      ) : null}
    </div>
  );
}
