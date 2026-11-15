import { describe, expect, it } from 'vitest';
import { choosePlaylistUrl, PROXY_BASE, tizenVersion } from './route';

const TIZEN_50 =
  'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) 63.0.3239.84/5.0 TV Safari/537.36';
const TIZEN_65 =
  'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('tizenVersion', () => {
  it('reads the Tizen version from a TV user agent', () => {
    expect(tizenVersion(TIZEN_50)).toEqual({ major: 5, minor: 0 });
    expect(tizenVersion(TIZEN_65)).toEqual({ major: 6, minor: 5 });
  });

  it('falls back to the TV Chromium number when TizenBrew overrides the Tizen part', () => {
    const overridden = 'Mozilla/5.0 (X11; Linux) AppleWebKit/537.36 (KHTML, like Gecko) 63.0.3239.84/5.0 TV Safari/537.36';
    expect(tizenVersion(overridden)).toEqual({ major: 5, minor: 0 });
    const tizen55 = 'Mozilla/5.0 (X11; Linux) AppleWebKit/537.36 (KHTML, like Gecko) 69.0.3497.106/5.5 TV Safari/537.36';
    expect(tizenVersion(tizen55)).toEqual({ major: 5, minor: 5 });
  });

  it('is null off the TV', () => {
    expect(tizenVersion(DESKTOP)).toBeNull();
  });
});

describe('choosePlaylistUrl', () => {
  const PLAYBACK = 'https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/x.m3u8?token=a&b=c';
  const enc = encodeURIComponent(PLAYBACK);

  it('AVPlay on Tizen 5.x goes through the proxy, with every playlist served plain', () => {
    expect(choosePlaylistUrl(PLAYBACK, 'avplay', { major: 5, minor: 0 })).toBe(
      PROXY_BASE + '/master.m3u8?rewrite=1&u=' + enc,
    );
    expect(choosePlaylistUrl(PLAYBACK, 'avplay', { major: 5, minor: 5 })).toBe(
      PROXY_BASE + '/master.m3u8?rewrite=1&u=' + enc,
    );
  });

  it('AVPlay on Tizen 6 and newer plays the CDN direct', () => {
    expect(choosePlaylistUrl(PLAYBACK, 'avplay', { major: 6, minor: 0 })).toBe(PLAYBACK);
    expect(choosePlaylistUrl(PLAYBACK, 'avplay', { major: 8, minor: 0 })).toBe(PLAYBACK);
  });

  it('AVPlay with an unknown version takes the proxy, which works on every Tizen', () => {
    expect(choosePlaylistUrl(PLAYBACK, 'avplay', null)).toBe(PROXY_BASE + '/master.m3u8?rewrite=1&u=' + enc);
  });

  it('hls.js always loads the master through the proxy (no CORS for our origin), and media playlists direct', () => {
    expect(choosePlaylistUrl(PLAYBACK, 'hlsjs', { major: 5, minor: 0 })).toBe(PROXY_BASE + '/master.m3u8?u=' + enc);
    expect(choosePlaylistUrl(PLAYBACK, 'hlsjs', { major: 7, minor: 0 })).toBe(PROXY_BASE + '/master.m3u8?u=' + enc);
    expect(choosePlaylistUrl(PLAYBACK, 'hlsjs', null)).toBe(PROXY_BASE + '/master.m3u8?u=' + enc);
  });
});
