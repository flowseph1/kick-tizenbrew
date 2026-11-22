import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useFavourites, useScreenActions } from '../app/context';
import { ChatOverlay, useChat } from '../components/ChatOverlay';
import { ErrorScreen } from '../components/ErrorScreen';
import { InfoBar, type InfoBarButton } from '../components/InfoBar';
import type { Quality } from '../player/quality';
import { createPlaybackSession, type SessionState } from '../player/session';

/** The video plane (AVPlay or `<video>`) sits under the page; this class on <html> makes the page transparent. */
const PLAYING_CLASS = 'playing';

/** The Info Bar hides after this long with no key press. */
export const INFO_BAR_MS = 5000;

/** What is shown over the video: nothing, the Info Bar with its buttons, or the Info Bar with the Quality list. */
type Overlay = 'none' | 'bar' | 'quality';

/**
 * Full screen playback of one Channel's Livestream. OK shows the Info Bar (`session.channel()`);
 * its Quality list applies a Quality with `session.setQuality()`. The green key or the Chat button
 * shows the Chat Overlay (`useChat`).
 */
export function Playback({ slug }: { slug: string }) {
  const app = useApp();
  const { t } = app;
  const favourites = useFavourites();
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  // The Info Bar. `overlayRef` is read by the key handler, which can run twice before a re-render.
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const overlayRef = useRef<Overlay>('none');
  const [focusOn, setFocusOn] = useState<InfoBarButton>('favourite');
  const [qualities, setQualities] = useState<Quality[] | null | 'error'>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listRequest = useRef(0);

  function setOverlay(o: Overlay) {
    overlayRef.current = o;
    setOverlayState(o);
    clearTimeout(hideTimer.current);
    if (o !== 'none') hideTimer.current = setTimeout(() => setOverlay('none'), INFO_BAR_MS);
  }

  const session = useMemo(
    () =>
      createPlaybackSession({
        api: app.api,
        slug,
        tizen: app.playback.tizen,
        createPlayer: app.playback.createPlayer,
        proxyReady: app.playback.proxyReady,
        fetchText: app.playback.fetchText,
        onState: (s) => {
          setState(s);
          if (s.status === 'ended' || s.status === 'error') setOverlay('none');
        },
        onDone: () => app.back(),
      }),
    [app, slug],
  );

  useEffect(() => {
    session.start();
    return () => {
      session.stop();
      clearTimeout(hideTimer.current);
    };
  }, [session]);

  const showVideo = state.status !== 'error' && state.status !== 'ended';
  useEffect(() => {
    const root = document.documentElement;
    if (showVideo) root.classList.add(PLAYING_CLASS);
    else root.classList.remove(PLAYING_CLASS);
    return () => root.classList.remove(PLAYING_CLASS);
  }, [showVideo]);

  const chat = useChat({
    channel: () => session.channel(),
    createSocket: app.playback.createSocket,
    active: showVideo,
    onLivestreamEnded: () => session.livestreamEnded(),
  });

  function showInfoBar(): boolean {
    const ch = session.channel();
    if (!showVideo || !ch || !ch.livestream) return false;
    setFocusOn('favourite');
    setOverlay('bar');
    return true;
  }

  function openQualityList() {
    const id = ++listRequest.current;
    setQualities(null);
    setOverlay('quality');
    session.qualities().then(
      (list) => {
        if (id === listRequest.current) setQualities(list);
      },
      () => {
        if (id === listRequest.current) setQualities('error');
      },
    );
  }

  function closeQualityList() {
    listRequest.current++;
    setFocusOn('quality');
    setOverlay('bar');
  }

  function chooseQuality(q: Quality | null) {
    session.setQuality(q);
    closeQualityList();
  }

  /** Adds or removes the Favourite of the Channel playing (yellow key or the Info Bar button). */
  function onFavourite(): boolean {
    const ch = session.channel();
    if (!ch) return false;
    app.toggleFavourite({ slug: ch.slug, name: ch.name, avatarUrl: ch.avatarUrl });
    return true;
  }

  // Show or hide the Chat Overlay (the green key does the same).
  function onChat() {
    chat.toggle();
  }

  useScreenActions((action) => {
    // Any key while the Info Bar shows keeps it up for another 5 s.
    if (overlayRef.current !== 'none') setOverlay(overlayRef.current);
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
      case 'ok':
        // With the Info Bar up, OK presses the focused button (the App default).
        return overlayRef.current === 'none' ? showInfoBar() : false;
      case 'green':
        onChat();
        return true;
      case 'back':
        if (overlayRef.current === 'quality') closeQualityList();
        else if (overlayRef.current === 'bar') setOverlay('none');
        else if (chat.isOpen()) chat.close();
        else app.back();
        return true;
      case 'stop':
        app.back();
        return true;
      case 'yellow':
        onFavourite();
        return true;
      default:
        return false;
    }
  });

  if (state.status === 'error') {
    const detail = [session.failure(), app.playback.describe ? app.playback.describe() : '']
      .filter(Boolean)
      .join(' | ');
    return <ErrorScreen onRetry={() => session.start()} detail={detail} />;
  }

  let message: string | null = null;
  if (state.status === 'loading') message = t('loading');
  else if (state.status === 'reconnecting') message = t('playback.reconnecting');
  else if (state.status === 'paused') message = t('playback.paused');
  else if (state.status === 'ended') message = t('playback.ended');

  const channel = session.channel();
  return (
    <div class={'playback playback-' + state.status}>
      {message ? <div class="playback-message">{message}</div> : null}
      {chat.open && showVideo ? <ChatOverlay messages={chat.messages} /> : null}
      {overlay !== 'none' && channel ? (
        <InfoBar
          channel={channel}
          focusOn={focusOn}
          onFavourite={onFavourite}
          favourite={favourites.has(channel.slug)}
          onChat={onChat}
          chatOpen={chat.open}
          onQuality={openQualityList}
          quality={
            overlay === 'quality'
              ? { options: qualities, current: session.quality(), onChoose: chooseQuality }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
