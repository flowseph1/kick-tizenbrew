# Spec: Kick TizenBrew Module v1

Status: ready
Terms follow `GLOSSARY.md`. Architecture decision: `docs/adr/0001-own-app-module-not-tizen-kick-com.md`.

## Goal

A Viewer watches Kick Livestreams on a Samsung Tizen TV with the remote, through TizenBrew. No sign in.

## Out of scope for v1

- VODs, clips, Channel pages.
- Sign in, Kick "Following" list, sending chat messages.
- npm publishing (future: GitHub Action publishes on each version tag).
- Remembering the last Quality.

## Platform

| Item | Value |
|---|---|
| Module type | TizenBrew `app` module (`packageType: "app"`, `appPath: "dist/index.html"`) |
| Install | `gh/flowseph1/kick-tizenbrew` (latest `master`), or `@<tag>` to pin |
| Minimum TV | Tizen 5.0, 2019 (Chromium 63). Shipped JS and CSS must work on Chromium 63: no `?.`, `??` or other syntax newer than Chromium 63 in `dist/`. Test TV: UN58RU7100 (2019, Tizen 5.0). |
| Origin | `http://127.0.0.1:8081/module/<name>/` |
| Keys to register | `ColorF0Red`, `ColorF1Green`, `ColorF2Yellow`, `ColorF3Blue`, `MediaPlayPause`, `MediaPlay`, `MediaPause`, `MediaStop` |
| Stack | TypeScript, esbuild (target `chrome63`), Preact, Vitest |
| Release | Build to `dist/`, commit `dist/` on `master`, tag `vX.Y.Z` |

## Data source

Unofficial `https://kick.com/api` endpoints, called directly from the module (Kick reflects the Origin). The official `api.kick.com` is not used: it gives no playback URL and needs a client secret.

| Need | Endpoint (verify during implementation) |
|---|---|
| Channel, Livestream, playback URL, chatroom id | `GET /api/v2/channels/{slug}` |
| Top Livestreams | `GET https://kick.com/stream/livestreams/en?limit=24&sort=desc&page=1` (verified, CORS reflects our Origin). `sort=desc` orders by viewers; without it the order is newest first. `limit` max 32. The `/{lang}` segment is ignored (all languages). Laravel paginator: items in `data[]`. List items carry a tokenless `playback_url` that returns 403: fetch the Channel for playback. |
| Top Categories | `GET https://kick.com/api/v1/categories/top` (verified, CORS reflects our Origin). Plain array of subcategories (our Category): `slug`, `name`, `is_mature`, `viewers`, `tags[]`, `banner.src`, parent group in `category.slug` (for example `gambling`). `/api/v1/subcategories` is a paginated alternative whose banner is `banner.url`; the adapter reads both. |
| Livestreams in a Category | `GET https://kick.com/stream/livestreams/en?limit=32&sort=desc&page=1&subcategory={slug}` (verified, CORS reflects our Origin). Same endpoint and item shape as Top Livestreams, filtered by the Category slug; `category=` and `subcategory_id=` are ignored. `web.kick.com/api/v1/livestreams?category_id=` also works but has no CORS for our Origin. |
| Search | `GET /api/search?searched_word=...` |

All API responses map into our own types in one adapter module. The UI never reads raw Kick JSON. The adapter has Vitest tests with recorded fixtures.

## Playback

- One `Player` interface with two implementations:
  - `AvPlayPlayer`: `webapis.avplay`, used on the TV. Hardware video plane under transparent HTML.
  - `HlsJsPlayer`: `<video>` with hls.js, used in desktop Chrome for development, through a local dev proxy to the CDN.
- Tizen 5.x: AVPlay cannot read Kick's gzip playlists. A `serviceFile` (Node, ES5, runs on Node 4.4.3) proxies playlist requests and returns them uncompressed. Segments go direct to the CDN. On Tizen 6+ AVPlay uses the CDN direct. The test TV is Tizen 5.0, so the proxy path is the one verified first; confirm the direct path on a Tizen 6+ TV when one is available.
- Quality: Auto by default. The `Quality` list shows the variants from the master playlist (for example 1080p60, 720p60, 480p30, 360p30, 160p30). If the TV cannot switch variants in place, reopen the stream at the chosen variant. The choice is not remembered; every Livestream starts at Auto.

## Screens

### Home

- Top bar: `Search`, `Settings`.
- Row 1, Favourites: live Favourites first, then offline Favourites greyed out. Each group sorted by Watch Count (highest first). Ties: the most recently added Favourite first. Hidden if the Viewer has no Favourites.
- Row 2, Top Livestreams: most viewers now.
- Row 3, Categories: top Categories. OK opens the Category screen.
- Live status of Favourites refreshes every 60 s while Home is visible.
- Selecting an offline Favourite shows "Offline". It does not open playback.

### Category

A grid of the Livestreams in that Category, sorted by viewers. Back returns to Home.

### Search

- An input that opens the Samsung on screen keyboard.
- The search runs 400 ms after the last key press.
- Two result rows: Channels and Categories. A Channel that is live opens playback. An offline Channel shows "Offline".

### Playback

- The Livestream plays full screen.
- OK shows the Info Bar for 5 s: Channel name, title, Category, viewer count. Below it: `Favourite`, `Chat`, `Quality` buttons. Focus moves to the buttons. The Info Bar hides after 5 s with no key press.
- Green key: show or hide the Chat Overlay.
- Yellow key: add or remove the Favourite (also on any Livestream or Channel tile outside playback).
- Media keys: Play, Pause and PlayPause control the player. Stop returns to the previous screen.

### Chat Overlay

- Read only. Pusher websocket `wss://ws-us2.pusher.com/app/34bf7a0ff419a2a775b9?protocol=7`, channel `chatrooms.{chatroomId}.v2`, no auth. Verify the key on the TV.
- Semi transparent panel on the right side, about 25% of the screen width. The video stays full size.
- Kick emotes (`[emote:id:name]`) show as images. User names show in their Kick colour. No badges.
- Keeps the last 50 messages.
- Stays open until the Viewer closes it.

### Settings

- Content Filter: on or off. Off by default.
- Language: Auto (TV language), English, Español. Fallback is English.
- Module version, and the note "Not affiliated with Kick".

## Favourites and Watch Count

- Stored in `localStorage` on the TV. Each Favourite: Channel slug, display name, avatar URL, date added, Watch Count.
- The Watch Count goes up by 1 each time a Livestream of that Channel starts to play, from any screen.
- Only Favourites have a Watch Count. Removing a Favourite deletes it. A new Favourite starts at 0.
- Storage access is wrapped so the Module still runs if `localStorage` fails.

## Content Filter

When on, hide:
- Gambling Categories (for example Slots & Casino, and other gambling Categories; keep the list in one place).
- Livestreams that Kick marks as mature.

It applies to Top Livestreams, Categories, the Category screen and Search. It does not hide Favourites.

## Remote navigation

- Spatial navigation with arrows and OK on every screen. Focus is always visible.
- Back key:
  - Playback: close the Chat Overlay if it is open, else return to the previous screen.
  - Category, Search, Settings: return to Home.
  - Home: show "Press Back again to exit". A second Back within 2 s exits to TizenBrew.

## Errors

| Case | Behaviour |
|---|---|
| The Livestream ends during playback | Show "Livestream ended" for 5 s, then return to the previous screen. |
| The Kick API fails or blocks the request | Show an error screen with `Retry`. |
| The network drops during playback | The player tries to reconnect for 30 s, then shows the error screen. |

## Languages

All UI text comes from one string table with `en` and `es`. "Auto" uses the TV language (`tizen.systeminfo` locale, or `navigator.language`).

## Testing

- Vitest, no TV needed: API adapter mapping, Favourites and Watch Count ordering, Content Filter rules, Quality list from a master playlist, string table completeness.
- Desktop Chrome with `HlsJsPlayer` for the UI.
- On the TV: playback, AVPlay Quality switch, `serviceFile` proxy on Tizen 5.x, Chat Overlay, remote keys.
- A build check fails if `dist/` contains syntax newer than Chromium 63.

## Open items

- Whether AVPlay can switch Quality in place, or must reopen the stream.
