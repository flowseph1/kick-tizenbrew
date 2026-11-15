import type { Channel } from '../api/types';
import { useApp } from '../app/context';
import { favouriteTarget } from '../favourites/target';
import { formatCount } from './LivestreamTile';

/** A Channel from Search: picture, name, Live or Offline, followers. Offline Channels are greyed out. */
export function ChannelTile({ channel, onSelect }: { channel: Channel; onSelect?: () => void }) {
  const { t, isFavourite } = useApp();
  return (
    <div
      class={'channel-tile' + (channel.isLive ? '' : ' offline') + (isFavourite(channel.slug) ? ' is-favourite' : '')}
      data-focus
      onClick={onSelect}
      {...favouriteTarget(channel)}
    >
      <div class="channel-avatar">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" /> : null}</div>
      <div class="channel-name">{channel.name}</div>
      <div class="channel-meta">
        <span class={channel.isLive ? 'badge-live' : 'badge-offline'}>
          {channel.isLive ? t('search.live') : t('search.offline')}
        </span>{' '}
        {t('search.followers', { count: formatCount(channel.followerCount) })}
      </div>
    </div>
  );
}
