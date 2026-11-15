import { describe, expect, it } from 'vitest';
import master from '../../test/fixtures/master.m3u8?raw';
import { parseQualities } from './quality';

const VARIANT = 'https://fa723fc1b171.use23.playlist.live-video.net/v1/playlist/XXX.m3u8';

describe('parseQualities', () => {
  it('lists the master playlist variants, best first, labelled by height and frame rate', () => {
    const list = parseQualities(master);
    // Kick names the 480p30 variant "480p": the label comes from RESOLUTION and FRAME-RATE.
    expect(list.map((q) => q.label)).toEqual(['1080p60', '720p60', '480p30', '360p30', '160p30']);
    expect(list[0]).toEqual({ label: '1080p60', height: 1080, bandwidth: 8949814, url: VARIANT });
    expect(list[4]).toEqual({ label: '160p30', height: 160, bandwidth: 230000, url: VARIANT });
  });

  it('falls back to the video group NAME when a variant has no RESOLUTION, and sorts by bandwidth', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="low",NAME="Low"',
      '#EXT-X-STREAM-INF:BANDWIDTH=500000,VIDEO="low"',
      'https://a.live-video.net/low.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,FRAME-RATE=30.000',
      'https://a.live-video.net/720.m3u8',
    ].join('\r\n');
    expect(parseQualities(text).map((q) => [q.label, q.url])).toEqual([
      ['720p30', 'https://a.live-video.net/720.m3u8'],
      ['Low', 'https://a.live-video.net/low.m3u8'],
    ]);
  });

  it('gives an empty list for a media playlist or junk', () => {
    expect(parseQualities('#EXTM3U\n#EXTINF:2.0,\nseg1.ts\n')).toEqual([]);
    expect(parseQualities('')).toEqual([]);
  });
});
