import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useScreenActions } from '../app/context';
import { ErrorScreen } from '../components/ErrorScreen';
import { createPlaybackSession, type SessionState } from '../player/session';

/** The video plane (AVPlay or `<video>`) sits under the page; this class on <html> makes the page transparent. */
const PLAYING_CLASS = 'playing';

/**
 * Full screen playback of one Channel's Livestream. Ticket 05 adds the Info Bar on OK and Quality
 * (use `session.player()` and `session.channel()`); ticket 07 the Chat Overlay (`session.channel().chatroomId`).
 */
export function Playback({ slug }: { slug: string }) {
  const app = useApp();
  const { t } = app;
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const session = useMemo(
    () =>
      createPlaybackSession({
        api: app.api,
        slug,
        tizen: app.playback.tizen,
        createPlayer: app.playback.createPlayer,
        proxyReady: app.playback.proxyReady,
        onState: setState,
        onDone: () => app.back(),
      }),
    [app, slug],
  );

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  const showVideo = state.status !== 'error' && state.status !== 'ended';
  useEffect(() => {
    const root = document.documentElement;
    if (showVideo) root.classList.add(PLAYING_CLASS);
    else root.classList.remove(PLAYING_CLASS);
    return () => root.classList.remove(PLAYING_CLASS);
  }, [showVideo]);

  useScreenActions((action) => {
    switch (action) {
      case 'play':
        session.play();
        return true;
      case 'pause':
        session.pause();
        return true;
      case 'playPause':
        session.togglePause();
        return true;
      case 'stop':
      case 'back':
        app.back();
        return true;
      default:
        return false;
    }
  });

  if (state.status === 'error') return <ErrorScreen onRetry={() => session.start()} />;

  let message: string | null = null;
  if (state.status === 'loading') message = t('loading');
  else if (state.status === 'reconnecting') message = t('playback.reconnecting');
  else if (state.status === 'paused') message = t('playback.paused');
  else if (state.status === 'ended') message = t('playback.ended');

  return (
    <div class={'playback playback-' + state.status}>
      {message ? <div class="playback-message">{message}</div> : null}
    </div>
  );
}
