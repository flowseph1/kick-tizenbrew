// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Quality } from './quality';

// hls.js needs MSE, which happy-dom lacks: a fake at the library boundary, with the parts we use.
const instances: FakeHls[] = [];
class FakeHls {
  static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'error' };
  static ErrorTypes = { MEDIA_ERROR: 'mediaError' };
  static isSupported = () => true;
  handlers: Record<string, (event: string, data: unknown) => void> = {};
  levels: { bitrate: number; height: number }[] = [];
  currentLevel = -1;
  constructor() {
    instances.push(this);
  }
  on(event: string, fn: (event: string, data: unknown) => void) {
    this.handlers[event] = fn;
  }
  loadSource() {}
  attachMedia() {}
  destroy() {}
  recoverMediaError() {}
  /** What hls.js does once the master is read: levels sorted by bitrate, lowest first. */
  parsed() {
    this.levels = [
      { bitrate: 230000, height: 160 },
      { bitrate: 3422999, height: 720 },
      { bitrate: 8949814, height: 1080 },
    ];
    this.handlers['manifestParsed']('manifestParsed', {});
  }
}
vi.mock('hls.js/light', () => ({ default: FakeHls }));

const { HlsJsPlayer } = await import('./hlsjs');

const q720: Quality = { label: '720p60', height: 720, bandwidth: 3422999, url: 'https://a.live-video.net/720.m3u8' };

function opened() {
  const player = new HlsJsPlayer(() => {});
  player.open('http://127.0.0.1:8093/master.m3u8?u=x');
  return { player, hls: instances[instances.length - 1] };
}

describe('HlsJsPlayer Quality', () => {
  it('switches in place to the level with the variant bandwidth, and back to Auto', () => {
    const { player, hls } = opened();
    hls.parsed();
    expect(player.setQuality(q720)).toBe(true);
    expect(hls.currentLevel).toBe(1);
    expect(player.setQuality(null)).toBe(true);
    expect(hls.currentLevel).toBe(-1);
    player.close();
  });

  it('applies a Quality chosen before the master is parsed once it is', () => {
    const { player, hls } = opened();
    expect(player.setQuality(q720)).toBe(true);
    hls.parsed();
    expect(hls.currentLevel).toBe(1);
    player.close();
  });
});
