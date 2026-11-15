# 10: Settings and Spanish

**What to build:** The Viewer selects `Settings` in the top bar. The Settings screen has Language (Auto, English, Español), the Module version and the note "Not affiliated with Kick". The whole UI is available in English and Spanish. Auto uses the TV language and falls back to English. The choice stays on the TV.

See `.scratch/kick-module/spec.md` (Settings, Languages).

**Blocked by:** 02

**Status:** ready-for-agent

- [x] `Settings` opens from the top bar; Back returns to Home.
- [x] Language changes the UI at once and survives a restart.
- [ ] Auto picks Spanish on a Spanish TV and English otherwise.
- [x] Version and disclaimer show.
- [x] Vitest checks that `en` and `es` have the same keys.

## Comments

### Implementation (ticket-10 branch)

Verified without a TV, in Vitest with happy-dom: `Settings` in the Home top bar opens the Settings screen and Back returns to Home (not exit); choosing Español or English changes the UI at once, the choice is marked (`aria-pressed`), and it survives a remount on the same storage; the version (from `package.json`) and "Not affiliated with Kick" show; the Module still runs and switches language when `localStorage` throws. `resolveLanguage` is tested for `es-ES`, `es_MX`, `ES`, other languages and an empty one. `npm run build` passes the Chromium 63 gate.

Not verified, needs the test TV, so this box stays unchecked:
- Auto picks Spanish on a Spanish TV. The logic is tested with a passed in TV language. On the TV the language comes from `navigator.languages[0]` or `navigator.language` (`src/main.tsx`), because the research notes say `tizen.systeminfo` locale is unavailable to TizenBrew pages. Confirm on the TV that `navigator.language` follows the TV menu language (set the TV to Español, open the Module with Language Auto).
- Persistence across a real TV restart uses `localStorage` on the TizenBrew origin; tested only with an in memory storage.

### Notes for later tickets

- Strings: every new key goes in both `en` and `es` in `src/i18n/strings.ts`. The string table test is strict: missing or extra keys, empty text, or different `{placeholders}` fail it, and `es` is typed `Strings`, so `npm run typecheck` fails too.
- Settings: add a setting with one entry in `schema` in `src/settings/settings.ts` (default plus a check for stored values). Read it in a screen with `useApp().settings.<name>` (screens re-render on change) and change it with `useApp().setSetting('<name>', value)`. Stored as JSON under `kick.settings`; an invalid stored value falls back to the default. Add a `settings-row` section in `src/screens/Settings.tsx` (the Language row shows the option button pattern).
- Storage: `src/storage/storage.ts` has `browserStorage()`, `readJson()` and `writeJson()`, which never throw. Ticket 06 (Favourites) can reuse them.
- Focus: if a screen has no `data-autofocus` element yet (for example while loading), focus sits on the first focusable and moves to the `data-autofocus` element when it appears, unless the Viewer moved focus first. Home marks the first Top Livestreams tile with `autofocus` on `LivestreamTile`.
