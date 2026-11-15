# 03: Play a Livestream

**What to build:** The Viewer selects a Livestream tile and presses OK. The Livestream plays full screen at Auto Quality, on Tizen 5 TVs and on newer TVs. Media keys (Play, Pause, PlayPause) control it. Back or Stop returns to the previous screen. If the Livestream ends, the Viewer sees "Livestream ended" for 5 s and returns to the previous screen. If the network drops, the player tries to reconnect for 30 s, then shows the error screen.

Playback goes through one `Player` interface. On the TV it uses AVPlay. In desktop Chrome it uses `<video>` with hls.js, through a local dev proxy to the CDN.

AVPlay on Tizen 5 cannot read Kick's gzip compressed playlists. The Module ships a `serviceFile` that runs in TizenBrew's Node and serves the playlists uncompressed on localhost. Video segments still go direct to the CDN. On Tizen 6 and newer the Module does not use the proxy. The service file must be ES5, because TizenBrew's Node can be as old as 4.4.3. Replexo/kick-tizen is prior art for this proxy.

(Merged from the former ticket 04, because the test TV is a 2019 Tizen 5.0 model and cannot play without the proxy.)

See `.scratch/kick-module/spec.md` (Playback, Playback screen, Errors).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] OK on a Top Livestreams tile plays the Livestream full screen on the test TV (UN58RU7100, Tizen 5.0).
- [ ] The same flow plays in desktop Chrome through the dev player.
- [ ] The `serviceFile` serves master and variant playlists uncompressed, with segment URLs left absolute to the CDN.
- [ ] The Module routes playback through the proxy only on Tizen 5.x; the direct path is ready for Tizen 6+.
- [ ] The service file parses on Node 4.4.3 (ES5 only).
- [ ] Play, Pause and PlayPause keys work; Back and Stop return to the previous screen.
- [ ] A Livestream that ends shows "Livestream ended" for 5 s, then returns.
- [ ] A dropped network reconnects for up to 30 s, then shows the error screen.
