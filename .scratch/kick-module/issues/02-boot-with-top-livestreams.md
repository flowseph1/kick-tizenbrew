# 02: Module boots on the TV with a Top Livestreams row

**What to build:** The Viewer installs the Module from `gh/flowseph1/kick-tizenbrew` and opens it from TizenBrew. Home shows a Top Livestreams row with real Kick data. The Viewer moves through the row with the remote arrows and always sees which tile has focus. If the Kick API fails, the Viewer sees an error screen with `Retry`. On Home, Back shows "Press Back again to exit", and a second Back within 2 s exits to TizenBrew.

This ticket also sets up the base that later tickets use: the module becomes a TizenBrew `app` module, built with TypeScript, esbuild (target Chromium 63) and Preact, tested with Vitest. The built output is committed for `gh/` installs. A build check fails if the output contains syntax newer than Chromium 63. All Kick JSON goes through one API adapter that maps it to our own types. All UI text comes from a string table (`en` only for now). Desktop Chrome can run the UI for development.

See `.scratch/kick-module/spec.md` (Platform, Data source, Home, Remote navigation, Errors) and ADR 0001.

**Blocked by:** None (can start immediately). The test TV is a 2019 UN58RU7100 (Tizen 5.0, Chromium 63).

**Status:** ready-for-agent

- [ ] The module is an `app` module and opens from TizenBrew on the TV.
- [x] Home shows a Top Livestreams row: thumbnail, Channel name, title, viewer count.
- [x] Arrow keys move focus through the row; focus is always visible.
- [x] The Kick API failure shows an error screen with a working `Retry`.
- [ ] Back on Home: first press shows "Press Back again to exit", second press within 2 s exits.
- [x] The build fails on syntax newer than Chromium 63 in the output.
- [x] Vitest covers the API adapter mapping with recorded fixtures.
- [x] The UI runs in desktop Chrome for development.
- [x] The endpoint for Top Livestreams is found and recorded in the spec.

## Comments

### Implementation (ticket-02 branch)

Verified without a TV: Vitest (adapter mapping from a recorded fixture, string table, spatial navigation, key mapping, exit guard, and the App/Home flow in happy-dom: tiles, arrows, error and Retry, double Back), `npm run build` with the Chromium 63 gate, and the UI in desktop Chrome at 1920x1080 against live Kick data (tiles, focus outline, row scroll, "Press Back again to exit").

Not verified, needs the test TV (UN58RU7100, Tizen 5.0), so these boxes stay unchecked:
- The module installs as an `app` module and opens from TizenBrew.
- The second Back exits to TizenBrew. The logic is tested; the exit itself is `history.back()`, which should land on the TizenBrew UI because TizenBrew opened the page with `location.href`. If the Viewer set this module as TizenBrew's auto launch module, going back may relaunch it.
Remote key codes (arrows 37 to 40, OK 13, Back 10009) are standard Tizen codes but were only exercised as desktop keys.

The `check:syntax` gate was proven to fail on `?.`, `??`, `[].flat()`, a named regex group and flexbox `gap`.

### Notes for later tickets

- API: add methods to `KickApi` in `src/api/types.ts` and map them in `src/api/kick.ts`. `mapCategory` already accepts the subcategory shape. Only `createKickApi` touches raw Kick JSON.
- Routes: add a variant to `Route` in `src/app/routes.ts` and a case in `src/app/screens.tsx`. Open with `useApp().push(route)`, close with `useApp().back()`. Routing is in memory, never `pushState`, so Back from Home can reach TizenBrew.
- Keys: a screen sees remote actions first with `useScreenActions(handler)` (return true to stop the defaults). Defaults: arrows move focus, OK clicks the focused element, Back pops the route.
- Focus: mark focusable elements with `data-focus`, the preferred first one with `data-autofocus`. Focus shows as the `.focused` class. Overlays can call `focus.setScope()` to keep arrows inside them.
- Strings: add keys to the `en` table in `src/i18n/strings.ts`; the completeness test checks every other language has the same keys (ticket 10 adds `es`).
- `scripts/dev.mjs` serves `dist/` on `http://127.0.0.1:8081`; ticket 03 adds the playlist proxy routes there.
- Run `npm run build` and commit `dist/` with each change.

