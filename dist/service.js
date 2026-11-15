"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = function(cb, mod) {
  return function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
};

// src/service/proxy.cjs
var require_proxy = __commonJS({
  "src/service/proxy.cjs": function(exports2, module2) {
    "use strict";
    var http = require("http");
    var https = require("https");
    var url = require("url");
    var zlib = require("zlib");
    var PORT = 8093;
    var HOST_RE = /^([a-z0-9-]+\.)*(live-video\.net|kick\.com)$/;
    var TIMEOUT_MS = 15e3;
    var MAX_REDIRECTS = 3;
    var CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };
    function isAllowedUrl(u) {
      if (typeof u !== "string") return false;
      var p = url.parse(u);
      return p.protocol === "https:" && !!p.hostname && HOST_RE.test(p.hostname.toLowerCase());
    }
    function mapUris(text, baseUrl, map) {
      var out = [];
      var lines = String(text).split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === "") continue;
        if (line.charAt(0) === "#") out.push(line);
        else out.push(map(url.resolve(baseUrl, line)));
      }
      return out.join("\n") + "\n";
    }
    function rewriteMaster(text, baseUrl, mediaBase) {
      var kept = [];
      var lines = String(text).split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf("#EXT-X-MEDIA:") === 0 && line.indexOf("TYPE=SUBTITLES") !== -1) continue;
        kept.push(line.replace(/,SUBTITLES="[^"]*"/, ""));
      }
      return mapUris(kept.join("\n"), baseUrl, function(abs) {
        return mediaBase ? mediaBase + "/media.m3u8?u=" + encodeURIComponent(abs) : abs;
      });
    }
    function rewriteMedia(text, baseUrl) {
      return mapUris(text, baseUrl, function(abs) {
        return abs;
      });
    }
    function decode(headers2, buffer, cb) {
      var enc = String(headers2["content-encoding"] || "").toLowerCase();
      if (enc === "gzip") return zlib.gunzip(buffer, function(err, out) {
        cb(err, out ? out.toString("utf8") : "");
      });
      if (enc === "deflate") return zlib.inflate(buffer, function(err, out) {
        cb(err, out ? out.toString("utf8") : "");
      });
      cb(null, buffer.toString("utf8"));
    }
    function fetchText(u, cb, redirects) {
      var done = false;
      function finish(err, res) {
        if (done) return;
        done = true;
        cb(err, res);
      }
      var p = url.parse(u);
      var transport = p.protocol === "http:" ? http : https;
      var req = transport.request({
        method: "GET",
        protocol: p.protocol,
        hostname: p.hostname,
        port: p.port,
        path: p.path,
        headers: { Accept: "*/*", "User-Agent": "kick-tizenbrew" }
      }, function(res) {
        var status = res.statusCode;
        var location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          var next = url.resolve(u, location);
          if ((redirects || 0) >= MAX_REDIRECTS || !isAllowedUrl(next)) return finish(new Error("Redirect refused: " + next));
          return fetchText(next, finish, (redirects || 0) + 1);
        }
        var chunks = [];
        res.on("data", function(c) {
          chunks.push(c);
        });
        res.on("end", function() {
          decode(res.headers, Buffer.concat(chunks), function(err, body) {
            if (err) finish(err);
            else finish(null, { status: status, body: body });
          });
        });
        res.on("error", finish);
      });
      req.setTimeout(TIMEOUT_MS, function() {
        req.abort();
        finish(new Error("Timeout"));
      });
      req.on("error", finish);
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
      var text = body || "";
      res.writeHead(status, headers({
        "Content-Type": type || "text/plain; charset=utf-8",
        "Content-Length": Buffer.byteLength(text, "utf8"),
        "Cache-Control": "no-cache"
      }));
      res.end(text);
    }
    function createHandler(opts) {
      var get = opts && opts.fetchText || fetchText;
      var base = opts && opts.base || "http://127.0.0.1:" + PORT;
      function playlist(res, target, rewrite) {
        get(target, function(err, up) {
          try {
            if (err) return send(res, 502, "Upstream error: " + String(err && err.message));
            if (up.status !== 200) return send(res, 502, "Upstream answered " + up.status);
            var body = String(up.body || "").replace(/^﻿/, "");
            if (body.indexOf("#EXTM3U") !== 0) return send(res, 502, "Upstream did not send a playlist");
            send(res, 200, rewrite(body), "application/vnd.apple.mpegurl");
          } catch (e) {
            send(res, 500, String(e));
          }
        });
      }
      return function handler(req, res) {
        try {
          if (req.method === "OPTIONS") {
            res.writeHead(204, headers({}));
            return res.end();
          }
          var q = url.parse(req.url, true);
          var target = q.query.u;
          if (q.pathname === "/ping") return send(res, 200, "ok " + process.version);
          if (q.pathname !== "/master.m3u8" && q.pathname !== "/media.m3u8") return send(res, 404, "Not found");
          if (!isAllowedUrl(target)) return send(res, 403, "URL not allowed");
          if (q.pathname === "/master.m3u8") {
            var mediaBase = q.query.rewrite === "1" ? base : null;
            return playlist(res, target, function(body) {
              return rewriteMaster(body, target, mediaBase);
            });
          }
          return playlist(res, target, function(body) {
            return rewriteMedia(body, target);
          });
        } catch (e) {
          send(res, 500, String(e));
        }
      };
    }
    function start(port) {
      var server = http.createServer(createHandler({ base: "http://127.0.0.1:" + (port || PORT) }));
      server.on("error", function() {
      });
      server.listen(port || PORT, "127.0.0.1");
      return server;
    }
    module2.exports = {
      PORT: PORT,
      isAllowedUrl: isAllowedUrl,
      rewriteMaster: rewriteMaster,
      rewriteMedia: rewriteMedia,
      fetchText: fetchText,
      createHandler: createHandler,
      start: start
    };
  }
});

// src/service/main.cjs
var proxy = require_proxy();
if (!global.__kickTizenbrewService) {
  global.__kickTizenbrewService = true;
  process.on("uncaughtException", function(e) {
    try {
      console.log("kick-tizenbrew service: " + (e && e.stack ? e.stack : e));
    } catch (ignored) {
    }
  });
  proxy.start(proxy.PORT);
}
module.exports.onStart = function() {
};
