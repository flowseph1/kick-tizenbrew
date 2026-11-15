import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelDetail, KickApi, Livestream } from '../api/types';
import master from '../../test/fixtures/master.m3u8?raw';
import type { Quality } from './quality';
import { PROXY_BASE, type Engine, type TizenVersion } from './route';
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
  opened: string[] = [];
  calls: string[] = [];
  qualities: (string | null)[] = [];
  closed = false;
  constructor(
    public emit: (e: PlayerEvent) => void,
    readonly engine: Engine = 'hlsjs',
  ) {}
  open(url: string) {
    this.opened.push(url);
    this.closed = false;
  }
  /** Like the real players: hls.js switches in place, AVPlay cannot. */
  setQuality(q: Quality | null) {
    this.qualities.push(q ? q.label : null);
    return this.engine === 'hlsjs';
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

let fetched: string[];

function setup(
  channelFn: KickApi['channel'],
  proxyReady: () => Promise<boolean> = async () => true,
  more: { engine?: Engine; tizen?: TizenVersion | null } = {},
) {
  fetched = [];
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
    tizen: more.tizen === undefined ? null : more.tizen,
    createPlayer: (emit) => (player = new FakePlayer(emit, more.engine)),
    proxyReady,
    fetchText: async (url) => {
      fetched.push(url);
      return master;
    },
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

  it('shows "ended" for 5 s and then finishes when chat reports the Livestream end; only once', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });
    session.livestreamEnded();
    session.livestreamEnded();

    expect(states.filter((s) => s.status === 'ended')).toHaveLength(1);
    expect(player.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ignores a Livestream end from chat after leaving playback', async () => {
    const session = setup(async () => channel(true));
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    session.stop();
    session.livestreamEnded();
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    expect(states.filter((s) => s.status === 'ended')).toHaveLength(0);
    expect(done).not.toHaveBeenCalled();
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

describe('PlaybackSession Quality', () => {
  const VARIANT = 'https://fa723fc1b171.use23.playlist.live-video.net/v1/playlist/XXX.m3u8';

  async function playing(more: { engine?: Engine; tizen?: TizenVersion | null } = {}) {
    let token = 0;
    const session = setup(async () => channel(true, 'tok' + ++token), undefined, more);
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    player.emit({ type: 'playing' });
    return session;
  }

  it('lists the variants of the master, read through the proxy with a fresh token', async () => {
    const session = await playing();
    const list = await session.qualities();
    expect(list.map((q) => q.label)).toEqual(['1080p60', '720p60', '480p30', '360p30', '160p30']);
    expect(fetched).toEqual([PROXY_BASE + '/master.m3u8?u=' + encodeURIComponent(PLAYBACK.replace('t1', 'tok2'))]);
  });

  it('starts at Auto', async () => {
    const session = await playing();
    expect(session.quality()).toBeNull();
  });

  it('hls.js switches in place: no reopen', async () => {
    const session = await playing();
    const list = await session.qualities();
    session.setQuality(list[1]);
    expect(player.qualities).toEqual(['720p60']);
    expect(player.opened).toHaveLength(1);
    expect(session.quality()!.label).toBe('720p60');
    expect(last().status).toBe('playing');
  });

  it('AVPlay on Tizen 5 reopens at the variant through the proxy, and Auto reopens the master', async () => {
    const session = await playing({ engine: 'avplay', tizen: { major: 5, minor: 0 } });
    const list = await session.qualities();
    session.setQuality(list[1]);
    expect(player.opened[1]).toBe(PROXY_BASE + '/media.m3u8?u=' + encodeURIComponent(VARIANT));
    expect(last().status).toBe('loading');
    player.emit({ type: 'playing' });
    expect(last().status).toBe('playing');

    session.setQuality(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(session.quality()).toBeNull();
    expect(player.opened[2]).toContain('/master.m3u8?rewrite=1&u=');
  });

  it('choosing the Quality already playing does nothing', async () => {
    const session = await playing({ engine: 'avplay', tizen: { major: 5, minor: 0 } });
    session.setQuality(null);
    expect(player.opened).toHaveLength(1);
  });

  it('a reconnect keeps the Quality on hls.js; AVPlay reopens the master, so it goes back to Auto', async () => {
    const hls = await playing();
    hls.setQuality((await hls.qualities())[1]);
    player.emit({ type: 'error', detail: 'network' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.opened).toHaveLength(2);
    expect(hls.quality()!.label).toBe('720p60');
    expect(player.qualities).toEqual(['720p60', '720p60']);

    const av = await playing({ engine: 'avplay', tizen: { major: 5, minor: 0 } });
    av.setQuality((await av.qualities())[1]);
    player.emit({ type: 'error', detail: 'network' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(player.opened[2]).toContain('/master.m3u8?rewrite=1&u=');
    expect(av.quality()).toBeNull();
  });

  it('start() again (a new Livestream, or Retry) starts at Auto', async () => {
    const session = await playing();
    session.setQuality((await session.qualities())[0]);
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.quality()).toBeNull();
    expect(player.qualities).toEqual([]);
  });
});
