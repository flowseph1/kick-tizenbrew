// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import { createSettingsStore, type KeyValueStorage } from '../settings/settings';
import type { Category, Channel, KickApi, Livestream } from '../api/types';
import pkg from '../../package.json';

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
    ...api,
  };
  render(
    <App api={full} settings={createSettingsStore(storage)} tvLanguage={tvLanguage} exit={exit} now={() => now} />,
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
