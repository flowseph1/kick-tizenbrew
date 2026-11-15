// Playlist proxy for AVPlay on Tizen 5 and for hls.js.
//
// ES5 only, Node built ins only: this runs as the TizenBrew serviceFile in Node 4.4.3 on Tizen 5 TVs.
// No let/const, arrows, classes, template strings, Buffer.from/alloc, Array includes or padStart.
// The same code is the desktop dev proxy (scripts/dev.mjs).
//
// Why: the Kick video CDN gzips playlists for any client that sends Accept-Encoding: gzip.
// AVPlay on Tizen 5 sends that header but cannot read gzip, so it fails with NOT_SUPPORTED_FILE.
// The master playlist also has no CORS header for our origin, so hls.js cannot load it direct.
// We fetch playlists without Accept-Encoding and serve them plain with ACAO *. Segments stay on the CDN.
//
// Routes:
//   GET /ping                                   -> "ok <node version>"
//   GET /master.m3u8?u=<playback_url>[&rewrite=1] -> master, subtitles removed; rewrite=1 points variants at /media.m3u8
//   GET /media.m3u8?u=<variant url>             -> media playlist, segment URLs absolute to the CDN
'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var zlib = require('zlib');

var PORT = 8093;
var HOST_RE = /^([a-z0-9-]+\.)*(live-video\.net|kick\.com)$/;
var TIMEOUT_MS = 15000;
var MAX_REDIRECTS = 3;
var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

function isAllowedUrl(u) {
  if (typeof u !== 'string') return false;
  var p = url.parse(u);
  return p.protocol === 'https:' && !!p.hostname && HOST_RE.test(p.hostname.toLowerCase());
}

/** Turns each non comment line into the URL `map` returns for its absolute form. Drops empty lines. */
function mapUris(text, baseUrl, map) {
  var out = [];
  var lines = String(text).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line === '') continue;
    if (line.charAt(0) === '#') out.push(line);
    else out.push(map(url.resolve(baseUrl, line)));
  }
  return out.join('\n') + '\n';
}

/**
 * Master playlist: removes the subtitle groups (else the player polls 7 extra playlists) and makes
 * variant URIs absolute. With `mediaBase`, variants point at `<mediaBase>/media.m3u8?u=<abs url>`.
 */
function rewriteMaster(text, baseUrl, mediaBase) {
  var kept = [];
  var lines = String(text).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('#EXT-X-MEDIA:') === 0 && line.indexOf('TYPE=SUBTITLES') !== -1) continue;
    kept.push(line.replace(/,SUBTITLES="[^"]*"/, ''));
  }
  return mapUris(kept.join('\n'), baseUrl, function (abs) {
    return mediaBase ? mediaBase + '/media.m3u8?u=' + encodeURIComponent(abs) : abs;
  });
}

/** Media playlist: segment URLs absolute, so segments go direct to the CDN. */
function rewriteMedia(text, baseUrl) {
  return mapUris(text, baseUrl, function (abs) {
    return abs;
  });
}

function decode(headers, buffer, cb) {
  var enc = String(headers['content-encoding'] || '').toLowerCase();
  if (enc === 'gzip') return zlib.gunzip(buffer, function (err, out) { cb(err, out ? out.toString('utf8') : ''); });
  if (enc === 'deflate') return zlib.inflate(buffer, function (err, out) { cb(err, out ? out.toString('utf8') : ''); });
  cb(null, buffer.toString('utf8'));
}

/** GET `u` as text. No Accept-Encoding, so the CDN answers plain; gzip is still decoded if it comes. */
function fetchText(u, cb, redirects) {
  var done = false;
  function finish(err, res) {
    if (done) return;
    done = true;
    cb(err, res);
  }
  var p = url.parse(u);
  var transport = p.protocol === 'http:' ? http : https;
  var req = transport.request({
    method: 'GET',
    protocol: p.protocol,
    hostname: p.hostname,
    port: p.port,
    path: p.path,
    headers: { Accept: '*/*', 'User-Agent': 'kick-tizenbrew' }
  }, function (res) {
    var status = res.statusCode;
    var location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      var next = url.resolve(u, location);
      if ((redirects || 0) >= MAX_REDIRECTS || !isAllowedUrl(next)) return finish(new Error('Redirect refused: ' + next));
      return fetchText(next, finish, (redirects || 0) + 1);
    }
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      decode(res.headers, Buffer.concat(chunks), function (err, body) {
        if (err) finish(err);
        else finish(null, { status: status, body: body });
      });
    });
    res.on('error', finish);
  });
  req.setTimeout(TIMEOUT_MS, function () {
    req.abort();
    finish(new Error('Timeout'));
  });
  req.on('error', finish);
  req.end();
}

function headers(extra) {
  var h = {};
  var k;
  for (k in CORS) h[k] = CORS[k];
  for (k in extra) h[k] = extra[k];
  return h;
}

function send(res, status, body, type) {
  var text = body || '';
  res.writeHead(status, headers({
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text, 'utf8'),
    'Cache-Control': 'no-cache'
  }));
  res.end(text);
}

/**
 * The HTTP handler. `opts.fetchText(url, cb)` fetches upstream (tests pass a fake);
 * `opts.base` is this service's own origin, used in rewritten variant URLs.
 */
function createHandler(opts) {
  var get = (opts && opts.fetchText) || fetchText;
  var base = (opts && opts.base) || 'http://127.0.0.1:' + PORT;

  function playlist(res, target, rewrite) {
    get(target, function (err, up) {
      try {
        if (err) return send(res, 502, 'Upstream error: ' + String(err && err.message));
        if (up.status !== 200) return send(res, 502, 'Upstream answered ' + up.status);
        var body = String(up.body || '').replace(/^﻿/, '');
        if (body.indexOf('#EXTM3U') !== 0) return send(res, 502, 'Upstream did not send a playlist');
        send(res, 200, rewrite(body), 'application/vnd.apple.mpegurl');
      } catch (e) {
        send(res, 500, String(e));
      }
    });
  }

  return function handler(req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers({}));
        return res.end();
      }
      var q = url.parse(req.url, true);
      var target = q.query.u;
      if (q.pathname === '/ping') return send(res, 200, 'ok ' + process.version);
      if (q.pathname !== '/master.m3u8' && q.pathname !== '/media.m3u8') return send(res, 404, 'Not found');
      if (!isAllowedUrl(target)) return send(res, 403, 'URL not allowed');
      if (q.pathname === '/master.m3u8') {
        var mediaBase = q.query.rewrite === '1' ? base : null;
        return playlist(res, target, function (body) { return rewriteMaster(body, target, mediaBase); });
      }
      return playlist(res, target, function (body) { return rewriteMedia(body, target); });
    } catch (e) {
      send(res, 500, String(e));
    }
  };
}

/** Listens on 127.0.0.1:PORT. An earlier instance already listening (EADDRINUSE) is fine. */
function start(port) {
  var server = http.createServer(createHandler({ base: 'http://127.0.0.1:' + (port || PORT) }));
  server.on('error', function () {});
  server.listen(port || PORT, '127.0.0.1');
  return server;
}

module.exports = {
  PORT: PORT,
  isAllowedUrl: isAllowedUrl,
  rewriteMaster: rewriteMaster,
  rewriteMedia: rewriteMedia,
  fetchText: fetchText,
  createHandler: createHandler,
  start: start
};
