// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvPlayPlayer, type AvPlayApi, type AvPlayListener } from './avplay';
import { pickEngine, waitForProxy } from './pick';
import { PROXY_BASE } from './route';
import type { PlayerEvent } from './types';

describe('pickEngine', () => {
  it('uses AVPlay when webapis.avplay exists, else hls.js', () => {
    expect(pickEngine({ webapis: { avplay: {} } })).toBe('avplay');
    expect(pickEngine({ webapis: {} })).toBe('hlsjs');
    expect(pickEngine({})).toBe('hlsjs');
  });
});

describe('waitForProxy', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves true once /ping answers', async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    let n = 0;
    const ready = waitForProxy(async (url) => {
      asked.push(url);
      if (++n < 3) throw new TypeError('refused');
      return { ok: true };
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await ready).toBe(true);
    expect(asked).toEqual([PROXY_BASE + '/ping', PROXY_BASE + '/ping', PROXY_BASE + '/ping']);
  });

  it('resolves false when the service never starts', async () => {
    vi.useFakeTimers();
    const ready = waitForProxy(async () => {
      throw new TypeError('refused');
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(await ready).toBe(false);
  });
});

class FakeAvPlay implements AvPlayApi {
  log: string[] = [];
  state = 'NONE';
  listener: AvPlayListener | null = null;
  prepared: { ok: () => void; err: (e: unknown) => void } | null = null;
  open(url: string) {
    this.log.push('open ' + url);
    this.state = 'IDLE';
  }
  close() {
    this.log.push('close');
    this.state = 'NONE';
  }
  stop() {
    this.log.push('stop');
    this.state = 'IDLE';
  }
  play() {
    this.log.push('play');
    this.state = 'PLAYING';
  }
  pause() {
    this.log.push('pause');
    this.state = 'PAUSED';
  }
  getState() {
    return this.state;
  }
  setListener(l: AvPlayListener) {
    this.listener = l;
  }
  setDisplayRect(x: number, y: number, w: number, h: number) {
    this.log.push('rect ' + [x, y, w, h].join(','));
  }
  setDisplayMethod() {}
  prepareAsync(ok: () => void, err: (e: unknown) => void) {
    this.log.push('prepare');
    this.prepared = { ok, err };
  }
}

describe('AvPlayPlayer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function make() {
    const av = new FakeAvPlay();
    const events: PlayerEvent[] = [];
    const player = new AvPlayPlayer(av, (e) => events.push(e), document);
    return { av, events, player };
  }

  it('adds the AVPlay plane, opens full screen and plays when prepared', () => {
    const { av, events, player } = make();
    player.open('http://127.0.0.1:8093/master.m3u8?rewrite=1&u=x');

    expect(document.querySelector('object[type="application/avplayer"]')).not.toBeNull();
    expect(av.log).toEqual(['open http://127.0.0.1:8093/master.m3u8?rewrite=1&u=x', 'rect 0,0,1920,1080', 'prepare']);
    av.prepared!.ok();
    expect(av.log[av.log.length - 1]).toBe('play');
    expect(events).toEqual([{ type: 'playing' }]);
  });

  it('maps AVPlay errors, prepare failures and the stream end to player events', () => {
    const { av, events, player } = make();
    player.open('u1');
    av.prepared!.err('PLAYER_ERROR_CONNECTION_FAILED');
    av.listener!.onerror!('PLAYER_ERROR_CONNECTION_FAILED');
    av.listener!.onstreamcompleted!();
    expect(events).toEqual([
      { type: 'error', detail: 'PLAYER_ERROR_CONNECTION_FAILED' },
      { type: 'error', detail: 'PLAYER_ERROR_CONNECTION_FAILED' },
      { type: 'ended' },
    ]);
  });

  it('reopening stops and closes the previous stream first', () => {
    const { av, player } = make();
    player.open('u1');
    av.prepared!.ok();
    av.log = [];
    player.open('u2');
    expect(av.log.slice(0, 3)).toEqual(['stop', 'close', 'open u2']);
  });

  it('close() stops, frees AVPlay, removes the plane and sends no more events', () => {
    const { av, events, player } = make();
    player.open('u1');
    av.prepared!.ok();
    player.close();
    expect(av.state).toBe('NONE');
    expect(document.querySelector('object[type="application/avplayer"]')).toBeNull();
    av.listener!.onstreamcompleted!();
    expect(events).toEqual([{ type: 'playing' }]);
  });
});
