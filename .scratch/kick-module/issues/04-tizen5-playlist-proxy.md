# 04: Playlist proxy for Tizen 5.x

**What to build:** On a 2020 TV (Tizen 5.x), Livestreams play. AVPlay on Tizen 5 cannot read Kick's gzip compressed playlists, so the Module ships a `serviceFile` that runs in TizenBrew's Node and serves the playlists uncompressed on localhost. Video segments still go direct to the CDN. On Tizen 6 and newer the Module does not use the proxy.

The service file must be ES5, because it runs on Node 4.4.3.

See `.scratch/kick-module/spec.md` (Playback) and Replexo/kick-tizen for prior art.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The `serviceFile` serves master and variant playlists uncompressed, with segment URLs left absolute to the CDN.
- [ ] The Module routes playback through the proxy only on Tizen 5.x.
- [ ] A Livestream plays on a Tizen 5.x TV (or, if no such TV is available, the proxy is verified in Node and the skip path on Tizen 6+).
- [ ] The service file parses on Node 4.4.3 (ES5 only).
