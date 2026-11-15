# 03: Play a Livestream

**What to build:** The Viewer selects a Livestream tile and presses OK. The Livestream plays full screen at Auto Quality. Media keys (Play, Pause, PlayPause) control it. Back or Stop returns to the previous screen. If the Livestream ends, the Viewer sees "Livestream ended" for 5 s and returns to the previous screen. If the network drops, the player tries to reconnect for 30 s, then shows the error screen.

Playback goes through one `Player` interface. On the TV it uses AVPlay. In desktop Chrome it uses `<video>` with hls.js, through a local dev proxy to the CDN.

See `.scratch/kick-module/spec.md` (Playback, Playback screen, Errors).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] OK on a Top Livestreams tile plays the Livestream full screen on the TV (Tizen 6+).
- [ ] The same flow plays in desktop Chrome through the dev player.
- [ ] Play, Pause and PlayPause keys work; Back and Stop return to the previous screen.
- [ ] A Livestream that ends shows "Livestream ended" for 5 s, then returns.
- [ ] A dropped network reconnects for up to 30 s, then shows the error screen.
