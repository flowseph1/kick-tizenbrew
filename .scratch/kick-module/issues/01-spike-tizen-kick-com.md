# Spike: run tizen.kick.com inside a TizenBrew mods module

Status: claimed
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
