# 03: Play a Livestream

**What to build:** The Viewer selects a Livestream tile and presses OK. The Livestream plays full screen at Auto Quality, on Tizen 5 TVs and on newer TVs. Media keys (Play, Pause, PlayPause) control it. Back or Stop returns to the previous screen. If the Livestream ends, the Viewer sees "Livestream ended" for 5 s and returns to the previous screen. If the network drops, the player tries to reconnect for 30 s, then shows the error screen.

Playback goes through one `Player` interface. On the TV it uses AVPlay. In desktop Chrome it uses `<video>` with hls.js, through a local dev proxy to the CDN.

AVPlay on Tizen 5 cannot read Kick's gzip compressed playlists. The Module ships a `serviceFile` that runs in TizenBrew's Node and serves the playlists uncompressed on localhost. Video segments still go direct to the CDN. On Tizen 6 and newer the Module does not use the proxy. The service file must be ES5, because TizenBrew's Node can be as old as 4.4.3. Replexo/kick-tizen is prior art for this proxy.

(Merged from the former ticket 04, because the test TV is a 2019 Tizen 5.0 model and cannot play without the proxy.)

See `.scratch/kick-module/spec.md` (Playback, Playback screen, Errors).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] OK on a Top Livestreams tile plays the Livestream full screen on the test TV (UN58RU7100, Tizen 5.0).
- [x] The same flow plays in desktop Chrome through the dev player.
- [x] The `serviceFile` serves master and variant playlists uncompressed, with segment URLs left absolute to the CDN.
- [x] The Module routes playback through the proxy only on Tizen 5.x; the direct path is ready for Tizen 6+.
- [x] The service file parses on Node 4.4.3 (ES5 only).
- [x] Play, Pause and PlayPause keys work; Back and Stop return to the previous screen.
- [x] A Livestream that ends shows "Livestream ended" for 5 s, then returns.
- [x] A dropped network reconnects for up to 30 s, then shows the error screen.

## Comments

### Implementation (ticket-03 branch)

Seams under test (agreed from the ticket, as this run had no one to confirm with): `KickApi.channel`, the service proxy over HTTP with a fake CDN, `choosePlaylistUrl` and `tizenVersion`, `PlaybackSession` with a fake `Player` and fake timers, `AvPlayPlayer` against a fake `webapis.avplay`, and the App flow in happy-dom with a fake player.

Player choice: `webapis` may be undefined in TizenBrew module pages, so the Module picks `AvPlayPlayer` when `webapis.avplay` exists, else `HlsJsPlayer` (hls.js light, also on the TV). Both go through one `PlaybackSession`. Routing: AVPlay on Tizen 5.x takes the proxy for master and media playlists; AVPlay on Tizen 6+ plays direct; hls.js always loads only the master through the proxy (no CORS for our origin on the master). Recorded in the spec, Playback.

Verified without a TV:
- Vitest: all of the seams above.
- Desktop Chrome (1920x1080) against live Kick: OK on a Top Livestreams tile plays full screen at 1920x1080 through `npm run dev`; space pauses ("Paused") and resumes; Escape returns to Home and removes the video. The network log shows the master through `127.0.0.1:8093`, and media playlists and segments direct to the CDN.
- The proxy against the live CDN, with a client that sends `Accept-Encoding: gzip` like AVPlay: master and media playlists come back plain (no `Content-Encoding`), subtitles removed, 5 variants, `rewrite=1` variants point at `/media.m3u8`, segment URLs absolute to the CDN and fetchable direct. The master direct has no ACAO for our origin, which confirms the hls.js routing.
- `dist/service.js` runs in a `vm` sandbox shaped like TizenBrew's (top level only) and answers `/ping`.
- Node 4.4.3: the build gate runs `es-check es5` on `dist/service.js` and rejects `Buffer.from/alloc`, `includes`, `padStart/padEnd` and `Object.values/entries`; both checks were proven to fail on an injected arrow and `Buffer.from`. It was not run on a real Node 4.4.3 binary.
- Media keys were exercised by Tizen key code (19, 415, 10252, 413) in Vitest and with space and Escape in Chrome.

Not verified, needs the test TV (UN58RU7100, Tizen 5.0), so this box stays unchecked:
- Playback on the TV. Unknown there: whether the page sees `webapis.avplay` (AVPlay path) or not (hls.js path), whether TizenBrew starts `dist/service.js` and the page reaches `127.0.0.1:8093`, and whether AVPlay accepts the rewritten playlists. If playback stalls on Tizen 5, remember Replexo's notes on the slow Tizen 5 DNS resolver and its `edge` trimming of the live window.
- The Tizen 6+ direct path is ready in code but needs a Tizen 6+ TV.

### Notes for later tickets

- 05 (Info Bar, Quality): `PlaybackSession.channel()` gives the `Channel` (name, Livestream title, Category, viewer count). `PlaybackSession.player()` gives the open `Player`; add a Quality method to the `Player` interface. `HlsJsPlayer.instance` is the hls.js object (`levels`, `currentLevel = i`, `-1` = Auto): it can switch in place. `AvPlayPlayer` has no in place switch: call `open(url)` again with the variant URL (route a variant through `/media.m3u8?u=` on Tizen 5) or reopen the master. Fetch the master text through `PROXY_BASE + '/master.m3u8?u='` to build the Quality list (`test/fixtures/master.m3u8`). Every `start()` opens the master, so a new Livestream starts at Auto. The Playback screen passes OK through (returns false) for the Info Bar.
- 07 (Chat): `PlaybackSession.channel().chatroomId` (Pusher `chatrooms.{id}.v2`) and `.id` (channel id, for `channel.{id}` and `StopStreamBroadcast`, which could call into the session's end handling). Close the websocket in the Playback screen cleanup next to `session.stop()`. Back is handled in `Playback.tsx` (`useScreenActions`): close the overlay there first.
- 06 (Watch Count): count when the session status first becomes `playing` (`onState`).
- Strings added: `playback.paused`, `playback.reconnecting`, `playback.ended`.
