// One Livestream's playback: fetches the Channel, opens the player, and applies the spec's rules.
// - The Livestream ends (player end, or the Channel is offline): "ended" for 5 s, then onDone().
// - The network drops: reconnect (fresh Channel and token, reopen) every few seconds for up to 30 s,
//   then "error". The UI shows the error screen; its Retry calls start() again.
import type { Channel, KickApi } from '../api/types';
import { choosePlaylistUrl, PROXY_BASE, type TizenVersion } from './route';
import type { Player, PlayerEvent, PlayerFactory } from './types';

export const ENDED_MS = 5000;
export const RECONNECT_MS = 30000;
export const RETRY_EVERY_MS = 3000;

export type SessionStatus = 'loading' | 'playing' | 'paused' | 'reconnecting' | 'ended' | 'error';

export interface SessionState {
  status: SessionStatus;
}

export interface SessionOptions {
  api: KickApi;
  slug: string;
  /** From tizenVersion(navigator.userAgent). Null off the TV. */
  tizen: TizenVersion | null;
  createPlayer: PlayerFactory;
  /** Resolves true once the playlist proxy answers /ping (the serviceFile starts after the page). */
  proxyReady: () => Promise<boolean>;
  onState: (state: SessionState) => void;
  /** The "ended" message was shown for 5 s: return to the previous screen. */
  onDone: () => void;
}

export interface PlaybackSession {
  start(): void;
  play(): void;
  pause(): void;
  togglePause(): void;
  /** Leaves playback: closes the player and cancels every timer. */
  stop(): void;
  /** The Channel being played, once fetched: name, chatroom id and Livestream for the Info Bar (05) and chat (07). */
  channel(): Channel | null;
  /** The player in use, for Quality changes (ticket 05). */
  player(): Player | null;
}

export function createPlaybackSession(opts: SessionOptions): PlaybackSession {
  let status: SessionStatus = 'loading';
  let current: Player | null = null;
  let channel: Channel | null = null;
  let run = 0;
  let proxyOk = false;
  let endedTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  function set(s: SessionStatus) {
    status = s;
    opts.onState({ status: s });
  }

  function clearTimers() {
    clearTimeout(endedTimer);
    clearTimeout(retryTimer);
    clearTimeout(deadline);
    endedTimer = retryTimer = deadline = undefined;
  }

  function closePlayer() {
    const p = current;
    current = null;
    if (p) p.close();
  }

  function ensurePlayer(): Player {
    if (current) return current;
    const p: Player = opts.createPlayer((e) => {
      if (current === p) onPlayerEvent(e);
    });
    current = p;
    return p;
  }

  function ended() {
    clearTimers();
    closePlayer();
    set('ended');
    endedTimer = setTimeout(() => opts.onDone(), ENDED_MS);
  }

  function fail() {
    clearTimers();
    closePlayer();
    set('error');
  }

  /** Fetches the Channel (fresh token) and opens it. Rejects on any failure. */
  async function openFresh(id: number): Promise<void> {
    const ch = await opts.api.channel(opts.slug);
    if (id !== run) return;
    channel = ch;
    if (!ch.livestream || !ch.playbackUrl) {
      ended();
      return;
    }
    const player = ensurePlayer();
    const url = choosePlaylistUrl(ch.playbackUrl, player.engine, opts.tizen);
    if (url.indexOf(PROXY_BASE) === 0 && !proxyOk) {
      proxyOk = await opts.proxyReady();
      if (id !== run) return;
      if (!proxyOk) {
        fail();
        return;
      }
    }
    player.open(url);
  }

  function scheduleRetry() {
    if (retryTimer !== undefined) return;
    const id = run;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      openFresh(id).catch(() => {
        if (id === run && status === 'reconnecting') scheduleRetry();
      });
    }, RETRY_EVERY_MS);
  }

  function onPlayerEvent(e: PlayerEvent) {
    if (status === 'ended' || status === 'error') return;
    if (e.type === 'playing') {
      clearTimeout(retryTimer);
      clearTimeout(deadline);
      retryTimer = deadline = undefined;
      if (status !== 'paused') set('playing');
    } else if (e.type === 'ended') {
      ended();
    } else {
      if (status !== 'reconnecting') {
        set('reconnecting');
        deadline = setTimeout(fail, RECONNECT_MS);
      }
      scheduleRetry();
    }
  }

  return {
    start() {
      const id = ++run;
      clearTimers();
      closePlayer();
      set('loading');
      openFresh(id).catch(() => {
        if (id === run) fail();
      });
    },
    play() {
      if (!current || status !== 'paused') return;
      current.play();
      set('playing');
    },
    pause() {
      if (!current || status !== 'playing') return;
      current.pause();
      set('paused');
    },
    togglePause() {
      if (status === 'paused') this.play();
      else this.pause();
    },
    stop() {
      run++;
      clearTimers();
      closePlayer();
    },
    channel: () => channel,
    player: () => current,
  };
}
