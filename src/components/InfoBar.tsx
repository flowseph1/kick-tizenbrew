import type { ChannelDetail } from '../api/types';
import { useApp } from '../app/context';
import { sameQuality, type Quality } from '../player/quality';
import { formatCount } from './LivestreamTile';

export type InfoBarButton = 'favourite' | 'chat' | 'quality';

export interface InfoBarProps {
  channel: ChannelDetail;
  /** The button focused when the Info Bar opens (Quality after the Quality list closes). */
  focusOn: InfoBarButton;
  /** Ticket 06: add or remove the Favourite. */
  onFavourite: () => void;
  /** Ticket 06: true when the Channel is a Favourite (marks the button, `aria-pressed`). */
  favourite?: boolean;
  /** Ticket 07: show or hide the Chat Overlay. */
  onChat: () => void;
  /** Ticket 07: true while the Chat Overlay is open (marks the button, `aria-pressed`). */
  chatOpen?: boolean;
  onQuality: () => void;
  /** When set, the Quality list shows in place of the buttons. */
  quality?: QualityListProps;
}

/** The strip over the video: Channel, title, Category and viewer count, then the buttons (or the Quality list). */
export function InfoBar(props: InfoBarProps) {
  const { t } = useApp();
  const ls = props.channel.livestream;
  const meta: string[] = [];
  if (ls && ls.category) meta.push(ls.category.name);
  if (ls) meta.push(t('tile.viewers', { count: formatCount(ls.viewerCount) }));

  function button(id: InfoBarButton, label: string, onClick: () => void, pressed?: boolean) {
    return (
      <button
        class={'button info-bar-button info-bar-' + id}
        data-focus
        data-autofocus={props.focusOn === id ? true : undefined}
        aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <div class="info-bar">
      <div class="info-bar-channel">{props.channel.name}</div>
      {ls ? <div class="info-bar-title">{ls.title}</div> : null}
      <div class="info-bar-meta">{meta.join('  ·  ')}</div>
      {props.quality ? (
        <QualityList {...props.quality} />
      ) : (
        <div class="info-bar-buttons">
          {button('favourite', t('infoBar.favourite'), props.onFavourite, props.favourite)}
          {button('chat', t('infoBar.chat'), props.onChat, props.chatOpen)}
          {button('quality', t('infoBar.quality'), props.onQuality)}
        </div>
      )}
    </div>
  );
}

export interface QualityListProps {
  /** The variants, best first; null while loading; 'error' when the master could not be read. */
  options: Quality[] | null | 'error';
  /** The Quality in use; null is Auto. */
  current: Quality | null;
  onChoose: (quality: Quality | null) => void;
}

/** Auto, then the variants. Focus starts on the Quality in use. */
export function QualityList({ options, current, onChoose }: QualityListProps) {
  const { t } = useApp();
  if (options === null) return <div class="quality-list status">{t('loading')}</div>;
  if (options === 'error') return <div class="quality-list status">{t('quality.unavailable')}</div>;

  function option(q: Quality | null, label: string) {
    const selected = sameQuality(q, current);
    return (
      <button
        key={label}
        class={'button quality-option' + (selected ? ' selected' : '')}
        data-focus
        data-autofocus={selected ? true : undefined}
        aria-pressed={selected ? 'true' : 'false'}
        onClick={() => onChoose(q)}
      >
        {label}
      </button>
    );
  }

  return (
    <div class="quality-list info-bar-buttons">
      {option(null, t('quality.auto'))}
      {options.map((q) => option(q, q.label))}
    </div>
  );
}
