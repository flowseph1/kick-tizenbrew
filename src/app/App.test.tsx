// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import { createSettingsStore, type KeyValueStorage } from '../settings/settings';
import type { Category, KickApi, Livestream } from '../api/types';
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
