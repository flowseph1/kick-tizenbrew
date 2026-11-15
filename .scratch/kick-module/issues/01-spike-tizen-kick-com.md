# Spike: run tizen.kick.com inside a TizenBrew mods module

Status: resolved
Type: prototype

## Question

Does `https://tizen.kick.com` work well enough on the TV to be the base of the Module (approach a)?
If not, fall back to approach b: an `app` module with our own UI.

## Setup

- `package.json` at the repo root: `packageType: mods`, `websiteURL: https://tizen.kick.com`, `main: spike/probe.js`.
- `spike/probe.js` shows a diagnostic panel (bottom right). The blue key hides it.

## Checks (record results under Comments)

1. The site loads inside TizenBrew.
2. Remote navigation (arrows, OK, Back) moves through the UI.
3. A Livestream plays. Note the panel lines `video playing WxH`, or any `video error`.
4. Chat shows next to the video.
5. Search, Categories and a "Following" or sign in option exist.
6. Colour keys and media keys reach the page (panel lines `key: ...`).
7. The Chromium version and the TV model year.

## Comments

### Run 1 (2026-11-14)

- Check 1: the site loads, but only partly. The hero and the channel row stay as grey placeholders. "Categorías Top en vivo" shows images.
- Check 2: fail. The probe logs arrow keys and Enter, but the site does not react.
- Checks 3 to 5: blocked by check 2.
- Check 6: arrow keys and Enter reach the page.
- Check 7: the Chromium line scrolled out of the panel.

Analysis: tizen.kick.com is a Next.js app ("console" build on assets.kick.com). 36 of its 42 JS chunks use optional chaining (`?.`) and nullish coalescing (`??`), which need Chromium 80+. On Chromium 69 (Tizen 5.5) or 76 (Tizen 6.0) these chunks fail to parse. The page then shows only its server rendered HTML, with no client logic. This matches run 1.

Probe v2: pins the Chromium version and the TV model at the top of the panel.

Do not set `evaluateScriptOnDocumentStart`: TizenBrew does not navigate on a manual launch when it is true (the UI waits for a LaunchModule event that the service sends with `name`, but the UI matches on `fullName`). The module tile does nothing.

### Outcome

Approach (a) rejected. See docs/adr/0001-own-app-module-not-tizen-kick-com.md.

### Run 2 (2026-11-14, probe v2)

- The panel shows a burst of `js error: Script error.` (cross origin script errors, about 14 in 1 s at page load). This matches the chunk parse failures in the run 1 analysis.
- `tizen` and `webapis` are undefined on an external site, so the model is unknown.
- `chromium: unknown`: Tizen user agents omit `Chrome/`. Probe v3 prints the full user agent and parses the Tizen form.

### Test TV

UN58RU7100PXPA: 2019 model, Tizen 5.0, Chromium 63. The v1 target is lowered to Tizen 5.0 to include it. The former ticket 04 (playlist proxy) is merged into 03, because this TV needs the proxy to play.
