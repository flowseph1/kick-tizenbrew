import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelDetail, KickApi, Livestream } from '../api/types';
import { PROXY_BASE } from './route';
import { createPlaybackSession, ENDED_MS, RECONNECT_MS, type SessionState } from './session';
import type { Player, PlayerEvent } from './types';

const PLAYBACK = 'https://x.playback.live-video.net/api/video/v1/c.m3u8?token=t1';

const livestream: Livestream = {
  id: 1,
  channelSlug: 'xqc',
  channelName: 'xQc',
  channelAvatarUrl: '',
  title: 'Title',
  viewerCount: 10,
  isMature: false,
  thumbnailUrl: '',
  category: null,
};

function channel(live: boolean, token = 't1'): ChannelDetail {
  return {
    id: 668,
    slug: 'xqc',
    name: 'xQc',
    avatarUrl: '',
    chatroomId: 4242,
    playbackUrl: PLAYBACK.replace('t1', token),
    livestream: live ? livestream : null,
  };
}

class FakePlayer implements Player {
  readonly engine = 'hlsjs' as const;
  opened: string[] = [];
  calls: string[] = [];
  closed = false;
  constructor(public emit: (e: PlayerEvent) => void) {}
  open(url: string) {
    this.opened.push(url);
    this.closed = false;
  }
  play() {
    this.calls.push('play');
  }
  pause() {
    this.calls.push('pause');
  }
  close() {
    this.closed = true;
  }
}

let player: FakePlayer;
let states: SessionState[];
let done: ReturnType<typeof vi.fn<() => void>>;

function setup(channelFn: KickApi['channel'], proxyReady: () => Promise<boolean> = async () => true) {
  states = [];
  done = vi.fn<() => void>();
  const api: KickApi = {
    topLivestreams: async () => [],
    topCategories: async () => [],
    categoryLivestreams: async () => [],
    search: async () => ({ channels: [], categories: [] }),
    channelLivestream: async () => null,
    channel: channelFn,
  };
  const session = createPlaybackSession({
    api,
    slug: 'xqc',
    tizen: null,
    createPlayer: (emit) => (player = new FakePlayer(emit)),
    proxyReady,
    onState: (s) => states.push(s),
    onDone: done,
  });
  return session;
}

function last() {
  return states[states.length - 1];
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('PlaybackSession', () => {
  it('fetches the Channel and opens the routed playlist; exposes the Channel for the Info Bar and chat', async () => {
    const calls: string[] = [];
    const session = setup(async (slug) => {
      calls.push(slug);
      return channel(true);
    });
    session.start();
    expect(last().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual(['xqc']);
    expect(player.opened).toEqual([PROXY_BASE + '/master.m3u8?u=' + encodeURIComponent(PLAYBACK)]);
    player.emit({ type: 'playing' });
    expect(last().status).toBe('playing');
    expect(session.channel()!.chatroomId).toBe(4242);
    expect(session.channel()!.livestream!.title).toBe('Title');
  });

  it('shows "ended" for 5 s and then finishes when the Channel is already offline', async () => {
    const session = setup(async () => channel(false));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(last().status).toBe('ended');
    await vi.advanceTimersByTimeAsync(ENDED_MS - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('shows "ended" for 5 s and then finishes when the player reports the end', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });
    player.emit({ type: 'ended' });

    expect(last().status).toBe('ended');
    expect(player.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('reconnects after a network error with a fresh playback token', async () => {
    let token = 0;
    const session = setup(async () => channel(true, 'tok' + ++token));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });

    player.emit({ type: 'error', detail: 'network' });
    expect(last().status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.opened).toHaveLength(2);
    expect(player.opened[1]).toContain(encodeURIComponent('token=tok2'));

    player.emit({ type: 'playing' });
    expect(last().status).toBe('playing');
    await vi.advanceTimersByTimeAsync(RECONNECT_MS * 2);
    expect(last().status).toBe('playing');
    expect(done).not.toHaveBeenCalled();
  });

  it('keeps trying for 30 s, then shows the error', async () => {
    let fail = false;
    const session = setup(async () => {
      if (fail) throw new Error('offline');
      return channel(true);
    });
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });

    fail = true;
    player.emit({ type: 'error', detail: 'network' });
    await vi.advanceTimersByTimeAsync(RECONNECT_MS - 100);
    expect(last().status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(100);
    expect(last().status).toBe('error');
    expect(player.closed).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('a reconnect that keeps failing in the player also gives up at 30 s', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'error', detail: 'network' });
    for (let t = 0; t < RECONNECT_MS; t += 1000) {
      await vi.advanceTimersByTimeAsync(1000);
      if (last().status === 'reconnecting') player.emit({ type: 'error', detail: 'network' });
    }
    expect(last().status).toBe('error');
    expect(player.opened.length).toBeGreaterThan(2);
  });

  it('ends instead of reconnecting when the Channel went offline', async () => {
    let live = true;
    const session = setup(async () => channel(live));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });

    live = false;
    player.emit({ type: 'error', detail: 'playlist 404' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(last().status).toBe('ended');
  });

  it('pauses and plays with the media keys', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });

    session.togglePause();
    expect(last().status).toBe('paused');
    session.togglePause();
    expect(last().status).toBe('playing');
    session.pause();
    session.pause();
    session.play();
    expect(player.calls).toEqual(['pause', 'play', 'pause', 'play']);
  });

  it('stop() closes the player and cancels pending timers', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'ended' });
    session.stop();
    await vi.advanceTimersByTimeAsync(ENDED_MS * 2);
    expect(player.closed).toBe(true);
    expect(done).not.toHaveBeenCalled();
    player.emit({ type: 'playing' });
    expect(last().status).toBe('ended');
  });

  it('shows the error when Kick fails at the start, and start() again retries', async () => {
    let calls = 0;
    const session = setup(async () => {
      if (++calls === 1) throw new Error('blocked');
      return channel(true);
    });
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(last().status).toBe('error');

    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(player.opened).toHaveLength(1);
  });

  it('shows the error when the playlist proxy never answers', async () => {
    const session = setup(async () => channel(true), async () => false);
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(last().status).toBe('error');
  });
});
