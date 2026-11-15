# 02: Module boots on the TV with a Top Livestreams row

**What to build:** The Viewer installs the Module from `gh/flowseph1/kick-tizenbrew` and opens it from TizenBrew. Home shows a Top Livestreams row with real Kick data. The Viewer moves through the row with the remote arrows and always sees which tile has focus. If the Kick API fails, the Viewer sees an error screen with `Retry`. On Home, Back shows "Press Back again to exit", and a second Back within 2 s exits to TizenBrew.

This ticket also sets up the base that later tickets use: the module becomes a TizenBrew `app` module, built with TypeScript, esbuild (target Chromium 69) and Preact, tested with Vitest. The built output is committed for `gh/` installs. A build check fails if the output contains syntax newer than Chromium 69. All Kick JSON goes through one API adapter that maps it to our own types. All UI text comes from a string table (`en` only for now). Desktop Chrome can run the UI for development.

See `.scratch/kick-module/spec.md` (Platform, Data source, Home, Remote navigation, Errors) and ADR 0001.

**Blocked by:** None (can start immediately). Run probe v2 on the TV first if possible (spike 01), because this ticket replaces the `mods` setup.

**Status:** ready-for-agent

- [ ] The module is an `app` module and opens from TizenBrew on the TV.
- [ ] Home shows a Top Livestreams row: thumbnail, Channel name, title, viewer count.
- [ ] Arrow keys move focus through the row; focus is always visible.
- [ ] The Kick API failure shows an error screen with a working `Retry`.
- [ ] Back on Home: first press shows "Press Back again to exit", second press within 2 s exits.
- [ ] The build fails on ES2020+ syntax in the output.
- [ ] Vitest covers the API adapter mapping with recorded fixtures.
- [ ] The UI runs in desktop Chrome for development.
- [ ] The endpoint for Top Livestreams is found and recorded in the spec.
