import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';

const require = createRequire(import.meta.url);
// The service is plain ES5 CommonJS, because it runs in TizenBrew's Node (as old as 4.4.3).
const proxy = require('./proxy.cjs');

const master = readFileSync(new URL('../../test/fixtures/master.m3u8', import.meta.url), 'utf8');
const media = readFileSync(new URL('../../test/fixtures/media.m3u8', import.meta.url), 'utf8');

const MASTER_URL = 'https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/x.m3u8?token=abc';
const MEDIA_URL = 'https://fa723fc1b171.use23.playlist.live-video.net/v1/playlist/XXX.m3u8';
const BASE = 'http://127.0.0.1:8093';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + (server.address() as AddressInfo).port));
  });
}

type Upstream = { [url: string]: { status: number; body: string } };

/** Starts the service handler with a fake CDN. */
async function service(upstream: Upstream) {
  const asked: string[] = [];
  const fetchText = (url: string, cb: (err: Error | null, res?: { status: number; body: string }) => void) => {
    asked.push(url);
    const r = upstream[url];
    if (!r) cb(new Error('no route ' + url));
    else cb(null, r);
  };
  const origin = await listen(proxy.createHandler({ fetchText, base: BASE }));
  return { origin, asked };
}

function lines(text: string) {
  return text.split('\n').filter((l) => l.trim() !== '');
}

describe('service playlist proxy', () => {
  it('serves the master playlist uncompressed, without subtitles, with CDN variant URLs', async () => {
    const { origin, asked } = await service({ [MASTER_URL]: { status: 200, body: master } });
    const res = await fetch(origin + '/master.m3u8?u=' + encodeURIComponent(MASTER_URL));

    expect(asked).toEqual([MASTER_URL]);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('content-encoding')).toBeNull();
    const body = await res.text();
    expect(body).not.toContain('SUBTITLES');
    const uris = lines(body).filter((l) => l[0] !== '#');
    expect(uris).toHaveLength(5);
    expect(uris.every((u) => u === MEDIA_URL)).toBe(true);
    expect(body).toContain('#EXT-X-STREAM-INF:BANDWIDTH=8949814,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",VIDEO="chunked",FRAME-RATE=60.000\n');
  });

  it('with rewrite=1 points each variant at the proxy media route (the AVPlay path on Tizen 5)', async () => {
    const { origin } = await service({ [MASTER_URL]: { status: 200, body: master } });
    const body = await (await fetch(origin + '/master.m3u8?rewrite=1&u=' + encodeURIComponent(MASTER_URL))).text();

    const uris = lines(body).filter((l) => l[0] !== '#');
    expect(uris).toHaveLength(5);
    for (const u of uris) expect(u).toBe(BASE + '/media.m3u8?u=' + encodeURIComponent(MEDIA_URL));
  });

  it('serves a media playlist uncompressed with segment URLs left absolute to the CDN', async () => {
    const { origin } = await service({ [MEDIA_URL]: { status: 200, body: media } });
    const res = await fetch(origin + '/media.m3u8?u=' + encodeURIComponent(MEDIA_URL));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
    const segments = lines(await res.text()).filter((l) => l[0] !== '#');
    expect(segments.length).toBeGreaterThan(0);
    for (const s of segments) expect(s).toMatch(/^https:\/\/[a-z0-9.]+\.hls\.live-video\.net\/s1\/v1\/segment\/XXX\.ts$/);
  });

  it('makes relative segment URLs absolute against the playlist URL', async () => {
    const { origin } = await service({
      [MEDIA_URL]: { status: 200, body: '#EXTM3U\n#EXTINF:2.000,live\nseg/1.ts\n#EXTINF:2.000,live\n/root/2.ts\n' },
    });
    const body = await (await fetch(origin + '/media.m3u8?u=' + encodeURIComponent(MEDIA_URL))).text();
    expect(lines(body).filter((l) => l[0] !== '#')).toEqual([
      'https://fa723fc1b171.use23.playlist.live-video.net/v1/playlist/seg/1.ts',
      'https://fa723fc1b171.use23.playlist.live-video.net/root/2.ts',
    ]);
  });

  it('refuses URLs that are not https on a Kick video host, so it is not an open LAN proxy', async () => {
    const { origin, asked } = await service({});
    for (const u of [
      'http://fa723fc1b171.use23.playlist.live-video.net/x.m3u8',
      'https://evil.example.com/x.m3u8',
      'https://live-video.net.evil.com/x.m3u8',
      'not a url',
    ]) {
      const res = await fetch(origin + '/master.m3u8?u=' + encodeURIComponent(u));
      expect(res.status).toBe(403);
    }
    expect((await fetch(origin + '/master.m3u8')).status).toBe(403);
    expect(asked).toEqual([]);
  });

  it('answers 502 when the CDN fails or does not send a playlist', async () => {
    const { origin } = await service({
      [MASTER_URL]: { status: 403, body: 'denied' },
      [MEDIA_URL]: { status: 200, body: '<html>' },
    });
    expect((await fetch(origin + '/master.m3u8?u=' + encodeURIComponent(MASTER_URL))).status).toBe(502);
    expect((await fetch(origin + '/media.m3u8?u=' + encodeURIComponent(MEDIA_URL))).status).toBe(502);
    const down = await fetch(origin + '/media.m3u8?u=' + encodeURIComponent(MEDIA_URL + '?gone'));
    expect(down.status).toBe(502);
    expect(down.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('answers /ping so the page can wait for the service, and allows CORS preflight', async () => {
    const { origin } = await service({});
    const ping = await fetch(origin + '/ping');
    expect(ping.status).toBe(200);
    expect(await ping.text()).toMatch(/^ok v\d+/);
    const pre = await fetch(origin + '/master.m3u8', { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect((await fetch(origin + '/nope')).status).toBe(404);
  });
});

describe('service upstream fetch', () => {
  it('asks the CDN without Accept-Encoding and still decodes gzip if the CDN sends it', async () => {
    let seen: IncomingHttpHeaders = {};
    const upstream = await listen((req, res) => {
      seen = req.headers;
      res.writeHead(200, { 'Content-Encoding': 'gzip' });
      res.end(gzipSync('#EXTM3U\nplain\n'));
    });
    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      proxy.fetchText(upstream + '/x.m3u8', (err: Error | null, r: { status: number; body: string }) =>
        err ? reject(err) : resolve(r),
      );
    });
    expect(seen['accept-encoding']).toBeUndefined();
    expect(result).toEqual({ status: 200, body: '#EXTM3U\nplain\n' });
  });
});
