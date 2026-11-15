import type { Livestream } from '../api/types';
import { useApp } from '../app/context';

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function LivestreamTile({
  livestream,
  onSelect,
  autofocus,
}: {
  livestream: Livestream;
  onSelect?: () => void;
  /** Marks the tile the screen focuses first. */
  autofocus?: boolean;
}) {
  const { t } = useApp();
  return (
    <div class="tile" data-focus data-autofocus={autofocus || undefined} onClick={onSelect}>
      <div class="tile-thumb">
        {livestream.thumbnailUrl ? <img src={livestream.thumbnailUrl} alt="" /> : null}
        <span class="tile-viewers">{t('tile.viewers', { count: formatCount(livestream.viewerCount) })}</span>
      </div>
      <div class="tile-channel">{livestream.channelName}</div>
      <div class="tile-title">{livestream.title}</div>
    </div>
  );
}
