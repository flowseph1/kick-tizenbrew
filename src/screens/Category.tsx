import type { Category } from '../api/types';
import { useApp } from '../app/context';
import { useOpenLivestream } from '../app/openLivestream';
import { useAsync } from '../app/useAsync';
import { ErrorScreen } from '../components/ErrorScreen';
import { LivestreamTile } from '../components/LivestreamTile';

/** A grid of the Livestreams in one Category, most viewers first. Back (the App default) returns to Home. */
export function CategoryScreen({ category }: { category: Category }) {
  const { api, t } = useApp();
  const open = useOpenLivestream();
  const [list, reload] = useAsync(() => api.categoryLivestreams(category.slug));

  if (list.status === 'error') return <ErrorScreen onRetry={reload} />;

  return (
    <div class="category">
      <header class="top-bar">
        <h1 class="screen-title">{category.name}</h1>
      </header>
      {list.status === 'loading' ? (
        <p class="status">{t('loading')}</p>
      ) : list.value.length === 0 ? (
        <p class="status">{t('category.empty')}</p>
      ) : (
        <div class="grid">
          {list.value.map((ls) => (
            <LivestreamTile key={ls.id} livestream={ls} onSelect={() => open(ls)} />
          ))}
        </div>
      )}
    </div>
  );
}
