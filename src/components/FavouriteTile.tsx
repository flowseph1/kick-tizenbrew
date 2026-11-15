import type { Livestream } from '../api/types';
import { useApp } from '../app/context';
import type { Favourite } from '../favourites/favourites';
import { favouriteTarget } from '../favourites/target';
import { formatCount } from './LivestreamTile';

/**
 * A Favourite on Home: picture and name from the TV, plus the Livestream title when live.
 * `livestream` is null when offline (greyed out) and undefined before the first check.
 */
export function FavouriteTile({
  favourite,
  livestream,
  autofocus,
  onSelect,
}: {
  favourite: Favourite;
  livestream: Livestream | null | undefined;
  autofocus?: boolean;
  onSelect: () => void;
}) {
  const { t } = useApp();
  const offline = livestream === null;
  return (
    <div
      class={'channel-tile favourite-tile is-favourite' + (offline ? ' offline' : '')}
      data-focus
      data-autofocus={autofocus ? true : undefined}
      onClick={onSelect}
      {...favouriteTarget(favourite)}
    >
      <div class="channel-avatar">{favourite.avatarUrl ? <img src={favourite.avatarUrl} alt="" /> : null}</div>
      <div class="channel-name">{favourite.name}</div>
      <div class="channel-meta">
        {livestream ? (
          <span>
            <span class="badge-live">{t('search.live')}</span>{' '}
            {t('tile.viewers', { count: formatCount(livestream.viewerCount) })}
          </span>
        ) : offline ? (
          <span class="badge-offline">{t('search.offline')}</span>
        ) : null}
      </div>
      {livestream ? <div class="tile-title">{livestream.title}</div> : null}
    </div>
  );
}
