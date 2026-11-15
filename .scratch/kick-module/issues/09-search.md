# 09: Search

**What to build:** The Viewer selects `Search` in the top bar. The Samsung on screen keyboard opens. The search runs 400 ms after the last key press, with no confirm step. Results show in two rows: Channels and Categories. A live Channel plays its Livestream. An offline Channel shows "Offline". A Category opens the Category screen. Back returns to Home.

See `.scratch/kick-module/spec.md` (Search).

**Blocked by:** 08

**Status:** resolved

- [ ] `Search` in the top bar opens the input and the on screen keyboard on the TV.
- [x] The search runs 400 ms after the last key press.
- [x] Channel and Category result rows show; empty results show a message.
- [ ] Live Channel plays; offline Channel shows "Offline"; Category opens the Category screen.
- [x] Back returns to Home.

## Comments

### Implementation (ticket-09 branch)

Verified without a TV: Vitest covers the adapter (`search` from the recorded `search-xqc.json` and `search-slots.json`, word encoding, missing lists, errors; `channelLivestream` from `channel-live.json`, `channel-offline.json` and `channel-404.json`), the debounce (`src/app/debounce.ts`, fake timers: one run 400 ms after the last call, with the last word; cancel) and the App flow in happy-dom (Search in the top bar opens the screen with DOM focus on the input; three quick inputs give one search for the last word, nothing before 300 ms; blank words do not search; Channels and Categories rows; "No results" message; error screen with Retry; ArrowDown, OK or the IME Done key leave the input for the first result; offline Channel shows the "Offline" toast without a fetch; Category result opens the Category screen; Back returns to Home without the exit hint; Backspace edits the input on desktop). Both endpoints were checked live with curl and `Origin: http://127.0.0.1:8081`: 200, Origin reflected. `npm run build` passes the Chromium 63 gate.

Not verified, so the boxes stay unchecked:
- "Opens the on screen keyboard on the TV": the screen calls `input.focus()` on open (and again on OK when the focus ring is back on the input), which is what opens the Samsung keyboard. The IME Done (65376) and Cancel (65385) keys close it and move focus to the first result. Not tried on the test TV.
- "Live Channel plays": search results carry no Livestream, so OK on a live Channel loads it with `api.channelLivestream(slug)` (`/api/v2/channels/{slug}`) and passes it to `useOpenLivestream()`, which is a no op until ticket 03. If the Channel ended meanwhile, it shows "Offline". The offline and Category parts are tested.
- The layout was not viewed on the TV or in desktop Chrome.

Other changes:
- Home's top bar has `Search` before `Settings` (ticket 10). Ticket 10 merged first with the same focus fix (the first Top Livestreams tile is `data-autofocus` and takes over from a top bar fallback pick); the merge keeps ticket 10's `FocusManager`.
- Ticket 10 merged first with the `es` table and a completeness test, so the merge also adds `es` text for the `search.*` keys ("Buscar", "Canales", "Desconectado", ...). Ticket 10 may want to review the wording.
- The App no longer treats Backspace in a text input as Back (desktop only; Escape still goes Back).

### Notes for later tickets

- Content Filter (11): `SearchResults.categories` are full, unfiltered `Category` objects (`isMature`, `parentSlug`, `tags`), so `slots` maps to `parentSlug: 'gambling'`, `tags: ['Gambling']`, `isMature: true`. Search `Channel`s carry no mature flag; the mature flag is on the `Livestream` that `channelLivestream()` returns (`isMature`). Filter in `src/screens/Search.tsx` (the `Results` component), not in the adapter.
- Playback (03): if 03 adds its own Channel fetch for the playback URL, it can reuse or replace `channelLivestream` / `mapChannelLivestream` in `src/api/kick.ts`.
- Strings: the new keys are `search.*`.
