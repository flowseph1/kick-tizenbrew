# 05: Info Bar and Quality

**What to build:** During playback the Viewer presses OK. The Info Bar shows for 5 s with the Channel name, title, Category and viewer count. Below it are three buttons: `Favourite`, `Chat`, `Quality`. Focus moves to the buttons, and the Info Bar hides after 5 s with no key press. `Quality` opens a list with Auto and the variants from the master playlist (for example 1080p60, 720p60). The chosen Quality applies to the current Livestream. Every new Livestream starts at Auto.

`Favourite` and `Chat` show but do nothing until tickets 06 and 07.

See `.scratch/kick-module/spec.md` (Playback, Playback screen).

**Blocked by:** 03

**Status:** resolved

- [x] OK during playback shows the Info Bar with correct data; it hides after 5 s with no key press.
- [x] The three buttons take focus with arrows.
- [ ] `Quality` lists Auto plus the playlist variants; choosing one changes the video on the TV.
- [x] A new Livestream starts at Auto.
- [x] Vitest covers building the Quality list from a master playlist.
- [x] The spec records whether AVPlay switches Quality in place or reopens the stream.

## Comments

### Implementation (ticket-05 branch)

Seams under test (chosen from the ticket and ticket 03's seams, as this run had no one to confirm with): `parseQualities` with `test/fixtures/master.m3u8`; `chooseVariantUrl` and `masterTextUrl` in `route.ts`; `HlsJsPlayer.setQuality` against a fake hls.js at the library boundary; `AvPlayPlayer.setQuality` against the fake `webapis.avplay`; `PlaybackSession` Quality (`qualities`, `quality`, `setQuality`) with a fake player of each engine and fake timers; the Info Bar flow in the App in happy-dom.

Verified without a TV:
- Vitest: the seams above. The App tests cover the Info Bar data (Channel, title, Category, `12,345 viewers`), focus on `Favourite`, the 5 s hide that any key press restarts, arrows across the three buttons, the Quality list (Auto plus 1080p60, 720p60, 480p30, 360p30, 160p30, focus on the Quality in use), Back closing the list, then the Info Bar, then playback, and Auto on the next Livestream.
- Desktop Chrome (1920x1080, `npm run dev`) against live Kick: OK shows the Info Bar with real data; the list shows Auto and the 5 variants; choosing 720p60 switched the hls.js video from 1080 to 720 in place (no second master load for playback; the one extra master request is the list). Note: hls.js `level.bitrate` can differ from `BANDWIDTH`, so the height fallback in `HlsJsPlayer.applyQuality` matters.

Not verified, needs the test TV (UN58RU7100, Tizen 5.0), so the Quality box stays unchecked:
- Choosing a Quality changes the video on the TV. If the TV uses hls.js, it is the path verified on desktop. If it uses AVPlay, the session reopens AVPlay at the variant media playlist through `/media.m3u8?u=`: confirm AVPlay accepts a media playlist (not a master) as its URL, and how long the reopen takes (the screen shows "Loading" until AVPlay plays).
- The Info Bar over the AVPlay hardware plane (transparent page with `html.playing`).

### Notes for tickets 06 and 07

- Hooks are in `src/screens/Playback.tsx`: `onFavourite()` (06) and `onChat()` (07) are empty functions passed to `<InfoBar>`. `InfoBar` (`src/components/InfoBar.tsx`) also takes `favourite?: boolean` and `chatOpen?: boolean`, which set `aria-pressed` on the buttons; pass them once you have the state.
- Keys: the Playback key handler is in `useScreenActions` in `Playback.tsx`. Add `green` (07) and `yellow` (06) cases there. The overlay state is in `overlayRef` (read it, not the `overlay` state, in the key handler: two keys can arrive before a re-render). Back currently closes the Quality list, then the Info Bar, then leaves; 07 adds "close the Chat Overlay" before leaving (spec Remote navigation already says so).
- Every key press while the Info Bar shows restarts its 5 s timer (`setOverlay(overlayRef.current)`). A Chat Overlay must not block that, and it should stay open when the Info Bar hides.
- Strings added: `infoBar.favourite`, `infoBar.chat`, `infoBar.quality`, `quality.auto`, `quality.unavailable`. 06 may want separate "add"/"remove" labels.
- `PlaybackDeps` gained `fetchText` (used for the master text); test fakes of `PlaybackDeps` and `Player` need `fetchText` and `setQuality`.
