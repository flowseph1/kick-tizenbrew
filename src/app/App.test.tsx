// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import { createTranslator } from '../i18n/strings';
import type { Channel, KickApi, Livestream } from '../api/types';
import type { Player, PlayerEvent } from '../player/types';
import { PROXY_BASE } from '../player/route';

function stream(n: number, extra: Partial<Livestream> = {}): Livestream {
  return {
    id: n,
    channelSlug: 'chan' + n,
    channelName: 'Channel ' + n,
    channelAvatarUrl: '',
    title: 'Title ' + n,
    viewerCount: 1000 * n + 234,
    isMature: false,
    thumbnailUrl: 'https://images.kick.com/t' + n + '.webp',
    category: null,
    ...extra,
  };
}

let root: HTMLElement;
let exit: ReturnType<typeof vi.fn<() => void>>;
let now: number;

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** A TV remote key, by Tizen key code (media keys have no desktop key). */
function pressCode(keyCode: number) {
  const e = new KeyboardEvent('keydown', { bubbles: true });
  Object.defineProperty(e, 'keyCode', { value: keyCode });
  window.dispatchEvent(e);
}

class FakePlayer implements Player {
  readonly engine = 'hlsjs' as const;
  opened: string[] = [];
  calls: string[] = [];
  closed = false;
  constructor(public emit: (e: PlayerEvent) => void) {}
  open(url: string) {
    this.opened.push(url);
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

let players: FakePlayer[];

async function until(check: () => boolean) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('condition not met; DOM: ' + root.innerHTML);
}

function focusedText() {
  const el = root.querySelector('.focused');
  return el ? el.textContent : null;
}

function mount(partial: Partial<KickApi>) {
  const api: KickApi = {
    topLivestreams: async () => [],
    channel: async () => {
      throw new Error('channel() not faked');
    },
    ...partial,
  };
  const playback = {
    tizen: null,
    createPlayer: (emit: (e: PlayerEvent) => void) => {
      const p = new FakePlayer(emit);
      players.push(p);
      return p;
    },
    proxyReady: async () => true,
  };
  render(<App api={api} t={createTranslator('en')} exit={exit} now={() => now} playback={playback} />, root);
}

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  exit = vi.fn<() => void>();
  now = 10_000;
  players = [];
  // happy-dom has no layout. Lay focusables out left to right in document order.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const all = Array.prototype.slice.call(document.querySelectorAll('[data-focus]'));
    const i = all.indexOf(this);
    return { left: i * 100, top: 0, width: 90, height: 60, right: i * 100 + 90, bottom: 60, x: i * 100, y: 0 } as DOMRect;
  });
});

afterEach(() => {
  render(null, root);
  root.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Home', () => {
  it('shows a Top Livestreams row with thumbnail, Channel name, title and viewer count', async () => {
    mount({ topLivestreams: async () => [stream(1), stream(2)] });
    await until(() => root.querySelectorAll('.tile').length === 2);

    expect(root.textContent).toContain('Top Livestreams');
    const first = root.querySelector('.tile')!;
    expect(first.textContent).toContain('Channel 1');
    expect(first.textContent).toContain('Title 1');
    expect(first.textContent).toContain('1,234 viewers');
    expect(first.querySelector('img')!.getAttribute('src')).toBe('https://images.kick.com/t1.webp');
  });

  it('focuses the first tile and moves focus with the arrows', async () => {
    mount({ topLivestreams: async () => [stream(1), stream(2), stream(3)] });
    await until(() => root.querySelectorAll('.tile').length === 3);
    await until(() => focusedText() !== null);
    expect(focusedText()).toContain('Channel 1');

    press('ArrowRight');
    expect(focusedText()).toContain('Channel 2');
    press('ArrowRight');
    press('ArrowRight');
    expect(focusedText()).toContain('Channel 3');
    press('ArrowLeft');
    expect(focusedText()).toContain('Channel 2');
    expect(root.querySelectorAll('.focused')).toHaveLength(1);
  });

  it('shows an error screen with a Retry that loads again', async () => {
    let calls = 0;
    mount({
      topLivestreams: async () => {
        calls++;
        if (calls === 1) throw new Error('blocked');
        return [stream(1)];
      },
    });
    await until(() => root.textContent!.includes('Could not reach Kick'));
    await until(() => focusedText() === 'Retry');

    press('Enter');
    await until(() => root.querySelectorAll('.tile').length === 1);
    expect(calls).toBe(2);
    expect(root.textContent).not.toContain('Could not reach Kick');
  });

  it('asks for a second Back, and exits when it comes within 2 s', async () => {
    mount({ topLivestreams: async () => [stream(1)] });
    await until(() => root.querySelectorAll('.tile').length === 1);

    press('Escape');
    await until(() => root.textContent!.includes('Press Back again to exit'));
    expect(exit).not.toHaveBeenCalled();

    now += 1500;
    press('Escape');
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('does not exit when the second Back comes after 2 s', async () => {
    mount({ topLivestreams: async () => [stream(1)] });
    await until(() => root.querySelectorAll('.tile').length === 1);

    press('Escape');
    now += 2500;
    press('Escape');
    expect(exit).not.toHaveBeenCalled();
  });
});

function channelFor(ls: Livestream | null, slug = 'chan1'): Channel {
  return {
    id: 1,
    slug,
    name: 'Channel 1',
    avatarUrl: '',
    chatroomId: 11,
    playbackUrl: 'https://x.playback.live-video.net/api/video/v1/' + slug + '.m3u8?token=t',
    livestream: ls,
  };
}

describe('Playback', () => {
  async function openFirstTile(api: Partial<KickApi> = {}) {
    const asked: string[] = [];
    mount({
      topLivestreams: async () => [stream(1), stream(2)],
      channel: async (slug) => {
        asked.push(slug);
        return channelFor(stream(1), slug);
      },
      ...api,
    });
    await until(() => root.querySelectorAll('.tile').length === 2);
    await until(() => focusedText() !== null);
    press('Enter');
    await until(() => players.length === 1 && players[0].opened.length === 1);
    return asked;
  }

  it('OK on a Top Livestreams tile plays that Livestream full screen', async () => {
    const asked = await openFirstTile();
    expect(asked).toEqual(['chan1']);
    expect(players[0].opened[0]).toBe(
      PROXY_BASE + '/master.m3u8?u=' + encodeURIComponent('https://x.playback.live-video.net/api/video/v1/chan1.m3u8?token=t'),
    );
    expect(root.querySelector('.playback')).not.toBeNull();
    expect(root.querySelectorAll('.tile')).toHaveLength(0);
    expect(document.documentElement.classList.contains('playing')).toBe(true);
  });

  it('Pause, Play and PlayPause control the player', async () => {
    await openFirstTile();
    players[0].emit({ type: 'playing' });

    pressCode(19); // MediaPause
    await until(() => root.textContent!.includes('Paused'));
    pressCode(415); // MediaPlay
    await until(() => !root.textContent!.includes('Paused'));
    pressCode(10252); // MediaPlayPause
    pressCode(10252);
    press(' '); // desktop PlayPause
    expect(players[0].calls).toEqual(['pause', 'play', 'pause', 'play', 'pause']);
  });

  it('Back returns to the previous screen and closes the player', async () => {
    await openFirstTile();
    players[0].emit({ type: 'playing' });
    press('Escape');
    await until(() => root.querySelectorAll('.tile').length === 2);
    expect(players[0].closed).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains('playing')).toBe(false);
  });

  it('Stop returns to the previous screen', async () => {
    await openFirstTile();
    pressCode(413); // MediaStop
    await until(() => root.querySelectorAll('.tile').length === 2);
    expect(players[0].closed).toBe(true);
  });

  it('shows "Livestream ended" for 5 s when the Livestream ends, then returns', async () => {
    await openFirstTile();
    players[0].emit({ type: 'playing' });
    vi.useFakeTimers();
    players[0].emit({ type: 'ended' });
    await vi.advanceTimersByTimeAsync(0);
    expect(root.textContent).toContain('Livestream ended');

    await vi.advanceTimersByTimeAsync(4900);
    expect(root.querySelector('.playback')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(root.querySelector('.playback')).toBeNull();
    // Preact runs effects after a frame: let the faked frame timers fire so Home loads again.
    await vi.advanceTimersByTimeAsync(200);
    expect(root.querySelectorAll('.tile')).toHaveLength(2);
  });

  it('a dropped network shows Reconnecting, and after 30 s the error screen with Retry', async () => {
    let down = false;
    await openFirstTile({
      channel: async (slug) => {
        if (down) throw new Error('offline');
        return channelFor(stream(1), slug);
      },
    });
    players[0].emit({ type: 'playing' });
    vi.useFakeTimers();
    down = true;
    players[0].emit({ type: 'error', detail: 'networkError' });
    await vi.advanceTimersByTimeAsync(0);
    expect(root.textContent).toContain('Reconnecting');

    await vi.advanceTimersByTimeAsync(30000);
    expect(root.textContent).toContain('Could not reach Kick');
    await vi.advanceTimersByTimeAsync(200);
    vi.useRealTimers();
    await until(() => focusedText() === 'Retry');

    down = false;
    press('Enter');
    await until(() => players.length === 2 && players[1].opened.length === 1);
    expect(root.textContent).not.toContain('Could not reach Kick');
  });
});
