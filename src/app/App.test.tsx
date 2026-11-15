// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import type { Player, PlayerEvent } from '../player/types';
import type { Quality } from '../player/quality';
import masterFixture from '../../test/fixtures/master.m3u8?raw';
import { PROXY_BASE } from '../player/route';
import { createSettingsStore, type KeyValueStorage } from '../settings/settings';
import type { Category, Channel, ChannelDetail, KickApi, Livestream } from '../api/types';
import pkg from '../../package.json';
import { createFavouritesStore, type Favourite } from '../favourites/favourites';

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

function category(slug: string, extra: Partial<Category> = {}): Category {
  return {
    id: slug.length,
    slug,
    name: 'Cat ' + slug,
    parentSlug: 'games',
    isMature: false,
    tags: [],
    viewerCount: 100,
    bannerUrl: 'https://files.kick.com/' + slug + '.webp',
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
  qualities: (string | null)[] = [];
  closed = false;
  constructor(public emit: (e: PlayerEvent) => void) {}
  open(url: string) {
    this.opened.push(url);
  }
  setQuality(q: Quality | null) {
    this.qualities.push(q ? q.label : null);
    return true;
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

let storage: KeyValueStorage;

function memoryStorage(): KeyValueStorage {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

function mount(api: Partial<KickApi>, tvLanguage = 'en-US') {
  const full: KickApi = {
    topLivestreams: async () => [],
    topCategories: async () => [],
    categoryLivestreams: async () => [],
    search: async () => ({ channels: [], categories: [] }),
    channelLivestream: async () => null,
    channel: async () => {
      throw new Error('channel() not faked');
    },
    ...api,
  };
  const playback = {
    tizen: null,
    createPlayer: (emit: (e: PlayerEvent) => void) => {
      const p = new FakePlayer(emit);
      players.push(p);
      return p;
    },
    proxyReady: async () => true,
    fetchText: async () => masterFixture,
  };
  render(
    <App
      api={full}
      settings={createSettingsStore(storage)}
      favourites={createFavouritesStore(storage, () => now)}
      tvLanguage={tvLanguage}
      exit={exit}
      now={() => now}
      playback={playback}
    />,
    root,
  );
}

/** Restarts the Module on the same TV storage. */
function restart(api: Partial<KickApi>, tvLanguage?: string) {
  render(null, root);
  mount(api, tvLanguage);
}

function button(text: string): HTMLElement {
  const all = Array.prototype.slice.call(root.querySelectorAll<HTMLElement>('[data-focus]')) as HTMLElement[];
  const found = all.filter((el) => el.textContent === text)[0];
  if (!found) throw new Error('no button "' + text + '"; DOM: ' + root.innerHTML);
  return found;
}

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  exit = vi.fn<() => void>();
  now = 10_000;
  players = [];
  storage = memoryStorage();
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

function channelFor(ls: Livestream | null, slug = 'chan1'): ChannelDetail {
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

describe('Info Bar and Quality', () => {
  const live = stream(1, { title: 'Late night chess', viewerCount: 12345, category: category('chess', { name: 'Chess' }) });

  async function playing() {
    mount({
      topLivestreams: async () => [live],
      channel: async (slug) => channelFor(live, slug),
    });
    await until(() => root.querySelectorAll('.tile').length === 1);
    await until(() => focusedText() !== null);
    press('Enter');
    await until(() => players.length > 0 && players[players.length - 1].opened.length === 1);
    players[players.length - 1].emit({ type: 'playing' });
  }

  function infoBar() {
    return root.querySelector('.info-bar');
  }

  it('OK shows the Channel, title, Category and viewer count with focus on the buttons; it hides after 5 s with no key press', async () => {
    await playing();
    expect(infoBar()).toBeNull();
    vi.useFakeTimers();
    press('Enter');
    await vi.advanceTimersByTimeAsync(0);

    const bar = infoBar()!;
    expect(bar.textContent).toContain('Channel 1');
    expect(bar.textContent).toContain('Late night chess');
    expect(bar.textContent).toContain('Chess');
    expect(bar.textContent).toContain('12,345 viewers');
    expect(focusedText()).toBe('Favourite');

    // A key press restarts the 5 s.
    await vi.advanceTimersByTimeAsync(4000);
    press('ArrowRight');
    await vi.advanceTimersByTimeAsync(4900);
    expect(infoBar()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(infoBar()).toBeNull();
    expect(root.querySelector('.focused')).toBeNull();
  });

  it('the three buttons take focus with the arrows; Favourite and Chat do nothing yet', async () => {
    await playing();
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    press('ArrowRight');
    expect(focusedText()).toBe('Chat');
    press('ArrowRight');
    expect(focusedText()).toBe('Quality');
    press('ArrowLeft');
    press('Enter');
    press('ArrowLeft');
    press('Enter');
    expect(infoBar()).not.toBeNull();
    expect(players[0].opened).toHaveLength(1);
  });

  it('Quality lists Auto plus the variants, Auto first; choosing one applies it to the Livestream', async () => {
    await playing();
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    button('Quality').click();
    await until(() => !!root.querySelector('.quality-list'));
    await until(() => root.querySelectorAll('.quality-option').length === 6);

    const labels = Array.prototype.map.call(root.querySelectorAll('.quality-option'), (el: HTMLElement) => el.textContent);
    expect(labels).toEqual(['Auto', '1080p60', '720p60', '480p30', '360p30', '160p30']);
    expect(focusedText()).toBe('Auto');

    press('ArrowRight');
    press('ArrowRight');
    expect(focusedText()).toBe('720p60');
    press('Enter');
    await until(() => !root.querySelector('.quality-list'));
    expect(players[0].qualities).toEqual(['720p60']);
    expect(focusedText()).toBe('Quality');

    // The list opens on the Quality in use.
    press('Enter');
    await until(() => root.querySelectorAll('.quality-option').length === 6);
    expect(focusedText()).toBe('720p60');
  });

  it('Back closes the Quality list, then the Info Bar, then leaves playback', async () => {
    await playing();
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    button('Quality').click();
    await until(() => root.querySelectorAll('.quality-option').length === 6);

    press('Escape');
    await until(() => !root.querySelector('.quality-list'));
    expect(infoBar()).not.toBeNull();
    press('Escape');
    await until(() => !infoBar());
    expect(root.querySelector('.playback')).not.toBeNull();
    press('Escape');
    await until(() => root.querySelectorAll('.tile').length === 1);
  });

  it('a new Livestream starts at Auto', async () => {
    await playing();
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    button('Quality').click();
    await until(() => root.querySelectorAll('.quality-option').length === 6);
    button('1080p60').click();
    await until(() => !root.querySelector('.quality-list'));
    press('Escape');
    press('Escape');
    await until(() => root.querySelectorAll('.tile').length === 1);

    await until(() => focusedText() !== null);
    press('Enter');
    await until(() => players.length === 2 && players[1].opened.length === 1);
    players[1].emit({ type: 'playing' });
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    button('Quality').click();
    await until(() => root.querySelectorAll('.quality-option').length === 6);
    expect(focusedText()).toBe('Auto');
    expect(players[1].qualities).toEqual([]);
  });
});

describe('Settings', () => {
  const api: Partial<KickApi> = { topLivestreams: async () => [stream(1)] };

  async function openSettings() {
    await until(() => root.querySelectorAll('.tile').length === 1);
    button('Settings').click();
    await until(() => !!root.querySelector('.settings'));
  }

  it('opens from the top bar, and Back returns to Home', async () => {
    mount(api);
    await openSettings();
    expect(root.textContent).toContain('Language');

    press('Escape');
    await until(() => root.querySelectorAll('.tile').length === 1);
    expect(root.querySelector('.settings')).toBeNull();
    expect(exit).not.toHaveBeenCalled();
  });

  it('shows the Module version and the disclaimer', async () => {
    mount(api);
    await openSettings();
    expect(root.textContent).toContain('Version ' + pkg.version);
    expect(root.textContent).toContain('Not affiliated with Kick');
  });

  it('changes the language at once, and keeps it after a restart', async () => {
    mount(api);
    await openSettings();

    button('Español').click();
    await until(() => root.textContent!.includes('Idioma'));
    expect(root.textContent).toContain('No afiliado a Kick');

    press('Escape');
    await until(() => root.textContent!.includes('Directos más vistos'));

    restart(api);
    await until(() => root.textContent!.includes('Directos más vistos'));
    expect(root.textContent).toContain('Ajustes');
  });

  it('marks the chosen language', async () => {
    mount(api);
    await openSettings();
    expect(button('Auto').getAttribute('aria-pressed')).toBe('true');
    button('English').click();
    await until(() => button('English').getAttribute('aria-pressed') === 'true');
    expect(button('Auto').getAttribute('aria-pressed')).toBe('false');
  });

  it('uses Spanish on Auto when the TV is in Spanish, and English otherwise', async () => {
    mount(api, 'es-ES');
    await until(() => root.textContent!.includes('Directos más vistos'));

    restart(api, 'de-DE');
    await until(() => root.textContent!.includes('Top Livestreams'));
  });

  it('keeps English when the Viewer chose it on a Spanish TV', async () => {
    mount(api, 'es-ES');
    await openSettingsIn('Ajustes');
    button('English').click();
    await until(() => root.textContent!.includes('Language'));

    restart(api, 'es-ES');
    await until(() => root.textContent!.includes('Top Livestreams'));
  });

  async function openSettingsIn(label: string) {
    await until(() => root.querySelectorAll('.tile').length === 1);
    button(label).click();
    await until(() => !!root.querySelector('.settings'));
  }

  it('still runs when localStorage throws', async () => {
    storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    mount(api);
    await openSettings();
    button('Español').click();
    await until(() => root.textContent!.includes('Idioma'));
  });
});

describe('Categories', () => {
  it('shows a Categories row on Home with images and names', async () => {
    mount({ topLivestreams: async () => [stream(1)], topCategories: async () => [category('just-chatting'), category('slots')] });
    await until(() => root.querySelectorAll('.category-tile').length === 2);

    expect(root.textContent).toContain('Categories');
    const first = root.querySelector('.category-tile')!;
    expect(first.textContent).toContain('Cat just-chatting');
    expect(first.querySelector('img')!.getAttribute('src')).toBe('https://files.kick.com/just-chatting.webp');
  });

  async function openCategory(api: Partial<KickApi>) {
    mount({ topLivestreams: async () => [stream(1)], topCategories: async () => [category('just-chatting')], ...api });
    await until(() => root.querySelectorAll('.category-tile').length === 1);
    await until(() => focusedText() !== null);
    press('ArrowRight'); // from the Top Livestreams tile to the Category tile
    expect(focusedText()).toContain('Cat just-chatting');
    press('Enter');
  }

  it('opens the Category screen with a grid of its Livestreams on OK', async () => {
    const asked: string[] = [];
    await openCategory({
      categoryLivestreams: async (slug) => {
        asked.push(slug);
        return [stream(7), stream(8), stream(9)];
      },
    });
    await until(() => root.querySelectorAll('.grid .tile').length === 3);

    expect(asked).toEqual(['just-chatting']);
    expect(root.querySelector('h1')!.textContent).toBe('Cat just-chatting');
    expect(root.querySelector('.category-tile')).toBeNull();
    await until(() => focusedText() !== null);
    expect(focusedText()).toContain('Channel 7');
  });

  it('moves focus across and down the grid with the arrows', async () => {
    await openCategory({ categoryLivestreams: async () => [1, 2, 3, 4, 5, 6].map((n) => stream(n)) });
    await until(() => root.querySelectorAll('.grid .tile').length === 6);
    // Lay the grid out in rows of 4.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const all = Array.prototype.slice.call(document.querySelectorAll('[data-focus]'));
      const i = all.indexOf(this);
      const x = (i % 4) * 100;
      const y = Math.floor(i / 4) * 100;
      return { left: x, top: y, width: 90, height: 90, right: x + 90, bottom: y + 90, x, y } as DOMRect;
    });
    await until(() => focusedText() !== null);

    press('ArrowRight');
    expect(focusedText()).toContain('Channel 2');
    press('ArrowDown');
    expect(focusedText()).toContain('Channel 6');
    press('ArrowUp');
    expect(focusedText()).toContain('Channel 2');
  });

  it('shows a message when the Category has no Livestreams', async () => {
    await openCategory({ categoryLivestreams: async () => [] });
    await until(() => root.textContent!.includes('No Livestreams in this Category right now'));
  });

  it('shows the error screen with Retry when the Category fails to load', async () => {
    let calls = 0;
    await openCategory({
      categoryLivestreams: async () => {
        calls++;
        if (calls === 1) throw new Error('blocked');
        return [stream(7)];
      },
    });
    await until(() => focusedText() === 'Retry');
    press('Enter');
    await until(() => root.querySelectorAll('.grid .tile').length === 1);
    expect(calls).toBe(2);
  });

  it('returns to Home on Back, without the exit hint', async () => {
    await openCategory({ categoryLivestreams: async () => [stream(7)] });
    await until(() => root.querySelectorAll('.grid .tile').length === 1);

    press('Escape');
    await until(() => root.querySelectorAll('.category-tile').length === 1);
    expect(root.textContent).toContain('Top Livestreams');
    expect(root.textContent).not.toContain('Press Back again to exit');
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('Search', () => {
  function channel(slug: string, extra: Partial<Channel> = {}): Channel {
    return { id: slug.length, slug, name: 'Name ' + slug, avatarUrl: '', isLive: false, followerCount: 10, ...extra };
  }

  function input() {
    return root.querySelector('input') as HTMLInputElement;
  }

  function type(text: string) {
    const el = input();
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function openSearch(api: Partial<KickApi>) {
    mount({ topLivestreams: async () => [stream(1)], ...api });
    await until(() => root.querySelectorAll('.tile').length === 1);
    await until(() => (focusedText() || '').includes('Channel 1'));
    press('ArrowLeft'); // from the first tile to Settings, then Search in the top bar
    press('ArrowLeft');
    expect(focusedText()).toBe('Search');
    press('Enter');
    await until(() => !!input() && document.activeElement === input());
  }

  it('opens from the top bar with the input focused, so the TV keyboard opens', async () => {
    await openSearch({});
    await until(() => document.activeElement === input());
    expect(input().classList.contains('focused')).toBe(true);
    expect(root.textContent).not.toContain('Top Livestreams');
  });

  it('searches once, 400 ms after the last key press, and shows Channel and Category rows', async () => {
    const asked: string[] = [];
    await openSearch({
      search: async (word) => {
        asked.push(word);
        return { channels: [channel('xqc', { isLive: true }), channel('xqcisoffline')], categories: [category('slots')] };
      },
    });
    type('x');
    type('xq');
    type('xqc');
    await wait(300);
    expect(asked).toEqual([]);
    await wait(150);
    await until(() => root.querySelectorAll('.channel-tile').length === 2);

    expect(asked).toEqual(['xqc']);
    expect(root.textContent).toContain('Channels');
    expect(root.querySelector('.channel-tile')!.textContent).toContain('Name xqc');
    expect(root.querySelector('.channel-tile')!.textContent).toContain('Live');
    expect(root.querySelectorAll('.channel-tile')[1].textContent).toContain('Offline');
    expect(root.textContent).toContain('Categories');
    expect(root.querySelector('.category-tile')!.textContent).toContain('Cat slots');
  });

  it('does not search for a blank word', async () => {
    const asked: string[] = [];
    await openSearch({ search: async (w) => (asked.push(w), { channels: [], categories: [] }) });
    type('   ');
    await wait(450);
    expect(asked).toEqual([]);
    expect(root.textContent).not.toContain('No results');
  });

  it('shows a message when nothing matches', async () => {
    await openSearch({});
    type('zzzz');
    await wait(400);
    await until(() => root.textContent!.includes('No results for "zzzz"'));
  });

  async function searchAndMoveDown(api: Partial<KickApi>) {
    await openSearch(api);
    type('xqc');
    await wait(400);
    await until(() => root.querySelectorAll('[data-focus]').length > 1);
    press('ArrowDown'); // leaves the input (closes the keyboard) for the first result
    expect(document.activeElement).not.toBe(input());
  }

  it('shows "Offline" for an offline Channel and does not open it', async () => {
    const opened: string[] = [];
    await searchAndMoveDown({
      search: async () => ({ channels: [channel('xqcisoffline')], categories: [] }),
      channelLivestream: async (slug) => (opened.push(slug), null),
    });
    expect(focusedText()).toContain('Name xqcisoffline');
    press('Enter');
    await until(() => root.querySelector('.toast') !== null);
    expect(root.querySelector('.toast')!.textContent).toBe('Offline');
    expect(opened).toEqual([]);
  });

  it('loads the Livestream of a live Channel to play it', async () => {
    const opened: string[] = [];
    await searchAndMoveDown({
      search: async () => ({ channels: [channel('xqc', { isLive: true })], categories: [] }),
      channelLivestream: async (slug) => (opened.push(slug), stream(1, { channelSlug: slug })),
    });
    press('Enter');
    await until(() => opened.length === 1);
    expect(opened).toEqual(['xqc']);
    expect(root.querySelector('.toast')).toBeNull();
  });

  it('shows "Offline" when a live Channel ended before OK', async () => {
    await searchAndMoveDown({
      search: async () => ({ channels: [channel('xqc', { isLive: true })], categories: [] }),
      channelLivestream: async () => null,
    });
    press('Enter');
    await until(() => root.querySelector('.toast') !== null);
    expect(root.querySelector('.toast')!.textContent).toBe('Offline');
  });

  it('opens the Category screen from a Category result', async () => {
    const asked: string[] = [];
    await searchAndMoveDown({
      search: async () => ({ channels: [], categories: [category('slots')] }),
      categoryLivestreams: async (slug) => (asked.push(slug), [stream(7)]),
    });
    expect(focusedText()).toContain('Cat slots');
    press('Enter');
    await until(() => root.querySelectorAll('.grid .tile').length === 1);
    expect(asked).toEqual(['slots']);
    expect(root.querySelector('h1')!.textContent).toBe('Cat slots');
  });

  describe('with the Content Filter on', () => {
    beforeEach(() => {
      storage.setItem('kick.settings', JSON.stringify({ contentFilter: true }));
    });

    it('hides gambling Category results', async () => {
      await openSearch({
        search: async () => ({
          channels: [],
          categories: [category('slots', { parentSlug: 'gambling', tags: ['Gambling'] }), category('fortnite')],
        }),
      });
      type('s');
      await wait(400);
      await until(() => root.querySelectorAll('.category-tile').length === 1);
      expect(root.textContent).toContain('Cat fortnite');
      expect(root.textContent).not.toContain('Cat slots');
    });

    it('says "No results" when the filter hid every result', async () => {
      await openSearch({
        search: async () => ({ channels: [], categories: [category('slots', { parentSlug: 'gambling' })] }),
      });
      type('slots');
      await wait(400);
      await until(() => root.textContent!.includes('No results for "slots"'));
    });

    it('does not play a live Channel whose Livestream is mature', async () => {
      await searchAndMoveDown({
        search: async () => ({ channels: [channel('xqc', { isLive: true })], categories: [] }),
        channelLivestream: async (slug) => stream(1, { channelSlug: slug, isMature: true }),
      });
      press('Enter');
      await until(() => root.querySelector('.toast') !== null);
      expect(root.querySelector('.toast')!.textContent).toBe('Hidden by the Content Filter');
    });

    it('still plays a live Channel whose Livestream is not mature', async () => {
      const opened: string[] = [];
      await searchAndMoveDown({
        search: async () => ({ channels: [channel('xqc', { isLive: true })], categories: [] }),
        channelLivestream: async (slug) => (opened.push(slug), stream(1, { channelSlug: slug })),
      });
      press('Enter');
      await until(() => opened.length === 1);
      await wait(10);
      expect(root.querySelector('.toast')).toBeNull();
    });
  });

  it('leaves the input for the results on the TV keyboard Done key', async () => {
    await openSearch({ search: async () => ({ channels: [channel('a')], categories: [] }) });
    type('a');
    await wait(400);
    await until(() => root.querySelectorAll('.channel-tile').length === 1);
    input().dispatchEvent(new KeyboardEvent('keydown', { keyCode: 65376, bubbles: true }));
    expect(document.activeElement).not.toBe(input());
    expect(focusedText()).toContain('Name a');
  });

  it('shows the error screen with Retry when the search fails', async () => {
    let calls = 0;
    await openSearch({
      search: async () => {
        calls++;
        if (calls === 1) throw new Error('blocked');
        return { channels: [channel('a')], categories: [] };
      },
    });
    type('a');
    await wait(400);
    await until(() => focusedText() === 'Retry');
    press('Enter');
    await until(() => root.querySelectorAll('.channel-tile').length === 1);
    expect(calls).toBe(2);
  });

  it('returns to Home on Back, without the exit hint', async () => {
    await openSearch({});
    press('Escape');
    await until(() => root.querySelectorAll('.tile').length === 1);
    expect(root.textContent).toContain('Top Livestreams');
    expect(root.textContent).not.toContain('Press Back again to exit');
    expect(exit).not.toHaveBeenCalled();
  });

  it('lets Backspace edit the input on desktop instead of going Back', async () => {
    await openSearch({});
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await wait(10);
    expect(input()).not.toBeNull();
    expect(root.textContent).not.toContain('Top Livestreams');
  });
});

describe('Content Filter', () => {
  async function openSettings() {
    await until(() => root.querySelectorAll('.tile').length >= 1);
    button('Settings').click();
    await until(() => !!root.querySelector('.settings'));
  }

  it('shows a switch in Settings, off by default, that stays on after a restart', async () => {
    const api = { topLivestreams: async () => [stream(1)] };
    mount(api);
    await openSettings();
    expect(root.textContent).toContain('Content Filter');
    expect(button('Off').getAttribute('aria-pressed')).toBe('true');
    expect(button('On').getAttribute('aria-pressed')).toBe('false');

    button('On').click();
    await until(() => button('On').getAttribute('aria-pressed') === 'true');

    restart(api);
    await openSettings();
    expect(button('On').getAttribute('aria-pressed')).toBe('true');
  });

  const slots = () => category('slots', { name: 'Slots & Casino', parentSlug: 'gambling', tags: ['Gambling'], isMature: true });

  /** The Viewer turned the Content Filter on in an earlier session. */
  function filterWasOn() {
    storage.setItem('kick.settings', JSON.stringify({ contentFilter: true }));
  }

  const homeApi: Partial<KickApi> = {
    topLivestreams: async () => [
      stream(1),
      stream(2, { isMature: true }),
      stream(3, { category: slots() }),
      stream(4),
    ],
    topCategories: async () => [category('just-chatting'), slots(), category('fortnite')],
  };

  it('shows everything on Home when off', async () => {
    mount(homeApi);
    await until(() => root.querySelectorAll('.category-tile').length === 3);
    expect(root.querySelectorAll('.tile').length).toBe(4);
  });

  it('hides mature and gambling Livestreams and gambling Categories on Home when on', async () => {
    filterWasOn();
    mount(homeApi);
    await until(() => root.querySelectorAll('.category-tile').length === 2);
    expect(root.textContent).not.toContain('Slots & Casino');
    expect(root.textContent).toContain('Channel 1');
    expect(root.textContent).toContain('Channel 4');
    expect(root.textContent).not.toContain('Channel 2');
    expect(root.textContent).not.toContain('Channel 3');
  });

  it('filters Home as soon as the Viewer turns it on', async () => {
    mount(homeApi);
    await openSettings();
    button('On').click();
    press('Escape');
    await until(() => root.querySelectorAll('.category-tile').length === 2);
    expect(root.textContent).not.toContain('Channel 2');
  });

  it('hides mature Livestreams on the Category screen when on', async () => {
    filterWasOn();
    mount({
      topLivestreams: async () => [stream(1)],
      topCategories: async () => [category('just-chatting')],
      categoryLivestreams: async () => [stream(5, { isMature: true }), stream(6)],
    });
    await until(() => root.querySelectorAll('.category-tile').length === 1);
    (root.querySelector('.category-tile') as HTMLElement).click();
    await until(() => !!root.querySelector('.grid .tile'));
    expect(root.textContent).toContain('Channel 6');
    expect(root.textContent).not.toContain('Channel 5');
  });
});

describe('Favourites', () => {
  function favourite(slug: string, extra: Partial<Favourite> = {}): Favourite {
    return { slug, name: 'Fav ' + slug, avatarUrl: '', addedAt: 1, watchCount: 0, ...extra };
  }

  /** Favourites the Viewer added in an earlier session. */
  function favouritesWere(list: Favourite[]) {
    storage.setItem('kick.favourites', JSON.stringify(list));
  }

  function stored(): Favourite[] {
    return JSON.parse(storage.getItem('kick.favourites') || '[]');
  }

  function favouriteTiles(): HTMLElement[] {
    return Array.prototype.slice.call(root.querySelectorAll('.favourite-tile'));
  }

  /** From Home: opens Search, types the word and waits for the Channel results. */
  async function searchFor(word: string) {
    button('Search').click();
    await until(() => !!root.querySelector('input'));
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = word;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 450)); // the 400 ms search delay
    await until(() => !!root.querySelector('.search .channel-tile'));
  }

  function rowTitles() {
    return Array.prototype.map.call(root.querySelectorAll('.row-title'), (el: HTMLElement) => el.textContent);
  }

  function toastText() {
    const el = root.querySelector('.toast');
    return el ? el.textContent : null;
  }

  it('yellow on a Top Livestreams tile adds the Favourite, and yellow again removes it', async () => {
    mount({ topLivestreams: async () => [stream(1), stream(2)] });
    await until(() => root.querySelectorAll('.tile').length === 2);
    await until(() => (focusedText() || '').includes('Channel 1'));
    expect(rowTitles()).toEqual(['Top Livestreams']);

    press('y');
    await until(() => favouriteTiles().length === 1);
    expect(toastText()).toBe('Added Channel 1 to Favourites');
    expect(rowTitles()).toEqual(['Favourites', 'Top Livestreams']);
    expect(favouriteTiles()[0].textContent).toContain('Channel 1');
    expect(stored()).toEqual([{ slug: 'chan1', name: 'Channel 1', avatarUrl: '', addedAt: now, watchCount: 0 }]);

    // Focus stays on the Top Livestreams tile, so yellow again removes it.
    expect(focusedText()).toContain('Title 1');
    press('y');
    await until(() => favouriteTiles().length === 0);
    expect(toastText()).toBe('Removed Channel 1 from Favourites');
    expect(rowTitles()).toEqual(['Top Livestreams']);
    expect(stored()).toEqual([]);
  });

  const liveSlugs = ['a', 'c', 'd'];
  const liveApi: Partial<KickApi> = {
    topLivestreams: async () => [stream(1)],
    channelLivestream: async (slug) =>
      liveSlugs.indexOf(slug) === -1 ? null : stream(slug.charCodeAt(0), { channelSlug: slug, title: 'Live ' + slug }),
    channel: async (slug) => channelFor(stream(1, { channelSlug: slug }), slug),
  };

  function seedFour() {
    favouritesWere([
      favourite('a', { watchCount: 1, addedAt: 1 }),
      favourite('b', { watchCount: 5, addedAt: 1 }),
      favourite('c', { watchCount: 3, addedAt: 1 }),
      favourite('d', { watchCount: 3, addedAt: 2 }),
    ]);
  }

  it('shows live Favourites first, then offline ones greyed out; each by Watch Count, ties newest first', async () => {
    seedFour();
    mount(liveApi);
    await until(() => favouriteTiles().length === 4 && !!root.querySelector('.favourite-tile.offline'));
    await until(() => favouriteTiles()[3].classList.contains('offline'));

    expect(rowTitles()[0]).toBe('Favourites');
    expect(favouriteTiles().map((el) => el.querySelector('.channel-name')!.textContent)).toEqual([
      'Fav d',
      'Fav c',
      'Fav a',
      'Fav b',
    ]);
    expect(favouriteTiles().map((el) => el.classList.contains('offline'))).toEqual([false, false, false, true]);
    expect(favouriteTiles()[0].textContent).toContain('Live d');
    expect(favouriteTiles()[3].textContent).toContain('Offline');
    await until(() => (focusedText() || '').includes('Fav d'));
  });

  it('OK on an offline Favourite shows "Offline" and does not play it', async () => {
    seedFour();
    mount(liveApi);
    await until(() => favouriteTiles().length === 4 && favouriteTiles()[3].classList.contains('offline'));
    favouriteTiles()[3].click();
    await until(() => toastText() !== null);
    expect(toastText()).toBe('Offline');
    expect(root.querySelector('.playback')).toBeNull();
    expect(players).toHaveLength(0);
  });

  it('OK on a live Favourite plays it and adds 1 to its Watch Count', async () => {
    seedFour();
    mount(liveApi);
    await until(() => favouriteTiles().length === 4 && favouriteTiles()[3].classList.contains('offline'));
    await until(() => (focusedText() || '').includes('Fav d'));
    press('Enter');
    await until(() => players.length === 1 && players[0].opened.length === 1);
    expect(players[0].opened[0]).toContain(encodeURIComponent('/d.m3u8'));
    expect(stored().filter((f) => f.slug === 'd')[0].watchCount).toBe(4);
    expect(stored().filter((f) => f.slug === 'c')[0].watchCount).toBe(3);
  });

  it('counts a watch of a Favourite started from Top Livestreams, a Category and Search, and none for others', async () => {
    favouritesWere([favourite('chan1', { name: 'Channel 1', watchCount: 2 })]);
    mount({
      topLivestreams: async () => [stream(1), stream(2)],
      topCategories: async () => [category('chess')],
      categoryLivestreams: async () => [stream(1)],
      search: async () => ({
        channels: [{ id: 1, slug: 'chan1', name: 'Channel 1', avatarUrl: '', isLive: true, followerCount: 1 }],
        categories: [],
      }),
      channelLivestream: async (slug) => stream(1, { channelSlug: slug }),
      channel: async (slug) => channelFor(stream(1), slug),
    });
    async function playThenBack(start: () => void) {
      const before = players.length;
      start();
      await until(() => players.length === before + 1);
      press('Escape');
      await until(() => !root.querySelector('.playback'));
    }

    await until(() => root.querySelectorAll('.tile').length === 2 && favouriteTiles().length === 1);
    await playThenBack(() => (root.querySelectorAll('.tile')[0] as HTMLElement).click());
    expect(stored()[0].watchCount).toBe(3);
    await until(() => root.querySelectorAll('.tile').length === 2);
    await playThenBack(() => (root.querySelectorAll('.tile')[1] as HTMLElement).click());
    expect(stored()[0].watchCount).toBe(3);

    await until(() => !!root.querySelector('.category-tile'));
    (root.querySelector('.category-tile') as HTMLElement).click();
    await until(() => !!root.querySelector('.grid .tile'));
    await playThenBack(() => (root.querySelector('.grid .tile') as HTMLElement).click());
    expect(stored()[0].watchCount).toBe(4);

    press('Escape');
    await until(() => !!root.querySelector('.home'));
    await searchFor('chan');
    await playThenBack(() => (root.querySelector('.search .channel-tile') as HTMLElement).click());
    expect(stored()[0].watchCount).toBe(5);
  });

  it('yellow on a Category screen tile or a Search Channel tile adds the Favourite', async () => {
    mount({
      topLivestreams: async () => [stream(1)],
      topCategories: async () => [category('chess')],
      categoryLivestreams: async () => [stream(7)],
      search: async () => ({
        channels: [{ id: 9, slug: 'xqc', name: 'xQc', avatarUrl: 'https://files.kick.com/xqc.webp', isLive: false, followerCount: 1 }],
        categories: [],
      }),
    });
    await until(() => !!root.querySelector('.category-tile'));
    (root.querySelector('.category-tile') as HTMLElement).click();
    await until(() => (focusedText() || '').includes('Channel 7'));
    press('y');
    await until(() => stored().length === 1);
    expect(stored()[0].slug).toBe('chan7');
    expect(root.querySelector('.grid .tile')!.classList.contains('is-favourite')).toBe(true);

    press('Escape');
    await until(() => !!root.querySelector('.home'));
    await searchFor('xqc');
    press('ArrowDown');
    await until(() => (focusedText() || '').includes('xQc'));
    press('y');
    await until(() => stored().length === 2);
    expect(stored()[1]).toEqual({ slug: 'xqc', name: 'xQc', avatarUrl: 'https://files.kick.com/xqc.webp', addedAt: now, watchCount: 0 });
    expect(toastText()).toBe('Added xQc to Favourites');
  });

  it('refreshes the live status every 60 s while Home is visible, and not on other screens', async () => {
    favouritesWere([favourite('a'), favourite('b', { addedAt: 2 })]);
    let liveNow = ['a'];
    const asked: string[] = [];
    vi.useFakeTimers();
    mount({
      topLivestreams: async () => [stream(1)],
      channelLivestream: async (slug) => {
        asked.push(slug);
        return liveNow.indexOf(slug) === -1 ? null : stream(1, { channelSlug: slug, title: 'Live ' + slug });
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    const names = () => favouriteTiles().map((el) => el.querySelector('.channel-name')!.textContent);
    expect(names()).toEqual(['Fav a', 'Fav b']);
    expect(asked).toHaveLength(2);

    liveNow = ['b'];
    await vi.advanceTimersByTimeAsync(59000);
    expect(asked).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(asked).toHaveLength(4);
    expect(names()).toEqual(['Fav b', 'Fav a']);
    expect(favouriteTiles()[1].classList.contains('offline')).toBe(true);

    // Away from Home, no checks.
    button('Settings').click();
    await vi.advanceTimersByTimeAsync(200);
    expect(root.querySelector('.settings')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(120000);
    expect(asked).toHaveLength(4);
  });

  it('shows and plays Favourites the Content Filter would hide', async () => {
    storage.setItem('kick.settings', JSON.stringify({ contentFilter: true }));
    favouritesWere([favourite('casino', { name: 'Casino' })]);
    const slots = category('slots', { parentSlug: 'gambling', tags: ['Gambling'], isMature: true });
    const hidden = stream(3, { channelSlug: 'casino', isMature: true, category: slots });
    mount({
      topLivestreams: async () => [stream(1), hidden],
      channelLivestream: async () => hidden,
      channel: async (slug) => channelFor(hidden, slug),
    });
    await until(() => favouriteTiles().length === 1 && root.querySelectorAll('.tile').length === 1);
    expect(favouriteTiles()[0].classList.contains('offline')).toBe(false);
    expect(favouriteTiles()[0].textContent).toContain('Casino');
    favouriteTiles()[0].click();
    await until(() => players.length === 1 && players[0].opened.length === 1);
    expect(toastText()).toBeNull();
    expect(stored()[0].watchCount).toBe(1);
  });

  it('keeps Favourites after a restart', async () => {
    const api = { topLivestreams: async () => [stream(1)] };
    mount(api);
    await until(() => (focusedText() || '').includes('Channel 1'));
    press('y');
    await until(() => favouriteTiles().length === 1);
    restart(api);
    await until(() => favouriteTiles().length === 1);
    expect(favouriteTiles()[0].textContent).toContain('Channel 1');
  });

  it('still adds Favourites, for this session, when localStorage throws', async () => {
    storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    mount({ topLivestreams: async () => [stream(1)] });
    await until(() => (focusedText() || '').includes('Channel 1'));
    press('y');
    await until(() => favouriteTiles().length === 1);
    expect(toastText()).toBe('Added Channel 1 to Favourites');
  });

  async function playing(api: Partial<KickApi> = {}) {
    mount({
      topLivestreams: async () => [stream(1)],
      channel: async (slug) => ({ ...channelFor(stream(1), slug), avatarUrl: 'https://files.kick.com/c1.webp' }),
      ...api,
    });
    await until(() => root.querySelectorAll('.tile').length === 1);
    await until(() => focusedText() !== null);
    press('Enter');
    await until(() => players.length === 1 && players[0].opened.length === 1);
    players[0].emit({ type: 'playing' });
  }

  it('yellow during playback adds and removes the Favourite of the Channel playing', async () => {
    await playing();
    press('y');
    await until(() => stored().length === 1);
    expect(stored()[0]).toEqual({
      slug: 'chan1',
      name: 'Channel 1',
      avatarUrl: 'https://files.kick.com/c1.webp',
      addedAt: now,
      watchCount: 0,
    });
    expect(toastText()).toBe('Added Channel 1 to Favourites');
    expect(root.querySelector('.playback')).not.toBeNull();

    press('y');
    await until(() => stored().length === 0);
    expect(toastText()).toBe('Removed Channel 1 from Favourites');
    // The Livestream keeps playing: no new player, no reload.
    expect(players).toHaveLength(1);
    expect(players[0].closed).toBe(false);
    expect(players[0].opened).toHaveLength(1);
  });

  it('the Info Bar Favourite button adds and removes the Favourite and shows which', async () => {
    await playing();
    press('Enter');
    await until(() => focusedText() === 'Favourite');
    expect(button('Favourite').getAttribute('aria-pressed')).toBe('false');

    press('Enter');
    await until(() => stored().length === 1);
    expect(button('Favourite').getAttribute('aria-pressed')).toBe('true');
    expect(toastText()).toBe('Added Channel 1 to Favourites');

    press('Enter');
    await until(() => stored().length === 0);
    expect(button('Favourite').getAttribute('aria-pressed')).toBe('false');
  });
});
