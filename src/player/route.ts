// Which playlist URL a player opens. See the spec, Playback.
//
// - AVPlay on Tizen 5.x cannot read the CDN's gzip playlists: master and media playlists go through
//   the serviceFile proxy, served plain (rewrite=1). Segments stay direct to the CDN.
// - AVPlay on Tizen 6+ reads gzip: it plays the CDN direct.
// - hls.js (desktop, or the TV when `webapis.avplay` is missing) decodes gzip itself, but the master
//   playlist has no CORS header for our origin: only the master goes through the proxy.
//   Media playlists and segments have `Access-Control-Allow-Origin: *` and go direct.

/** The serviceFile proxy (src/service/proxy.cjs). scripts/dev.mjs runs the same proxy on desktop. */
export const PROXY_BASE = 'http://127.0.0.1:8093';

export type Engine = 'avplay' | 'hlsjs';

export interface TizenVersion {
  major: number;
  minor: number;
}

/**
 * Reads the Tizen version from the user agent: `(SMART-TV; LINUX; Tizen 5.0)`, else the
 * `63.0.3239.84/5.0 TV` tail (still there when TizenBrew overrides part of the user agent). Null off the TV.
 */
export function tizenVersion(ua: string): TizenVersion | null {
  const m = /Tizen (\d+)\.(\d+)/.exec(ua) || /\d+\.\d+\.\d+\.\d+\/(\d+)\.(\d+) TV/.exec(ua);
  return m ? { major: Number(m[1]), minor: Number(m[2]) } : null;
}

/** True when AVPlay must get plain playlists from the proxy. Unknown versions take the proxy: it works everywhere. */
export function avplayNeedsProxy(version: TizenVersion | null): boolean {
  return !version || version.major < 6;
}

export function choosePlaylistUrl(playbackUrl: string, engine: Engine, version: TizenVersion | null): string {
  const u = encodeURIComponent(playbackUrl);
  if (engine === 'hlsjs') return PROXY_BASE + '/master.m3u8?u=' + u;
  if (avplayNeedsProxy(version)) return PROXY_BASE + '/master.m3u8?rewrite=1&u=' + u;
  return playbackUrl;
}
