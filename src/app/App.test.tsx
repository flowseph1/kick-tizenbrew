// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import { createTranslator } from '../i18n/strings';
import type { KickApi, Livestream } from '../api/types';

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
  render(<App api={api} t={createTranslator('en')} exit={exit} now={() => now} />, root);
}

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  exit = vi.fn<() => void>();
  now = 10_000;
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
