# 12: README and v0.1.0 release

**What to build:** A new Viewer reads the README, installs the Module in TizenBrew, and knows the remote keys. The README covers install (`gh/flowseph1/kick-tizenbrew`), the remote keys (OK, green, yellow, Back, media keys), the supported TVs (Tizen 5.0, 2019, and newer) and the note "Not affiliated with Kick". A full test on the TV against the spec passes, and `v0.1.0` is tagged.

**Blocked by:** 03, 06, 07, 11

**Status:** ready-for-agent

- [x] README covers install, keys, supported TVs and the disclaimer.
- [ ] A full test on the TV against `.scratch/kick-module/spec.md` passes; results are recorded in this file.
- [ ] `dist/` is up to date and committed; `v0.1.0` is tagged and pushed.

## Release status

README added. Integrated build is committed. All 210 tests, typecheck and Chromium 63 syntax checks pass. No TV is connected to this session. Full TV acceptance remains pending, so v0.1.0 has not been tagged or pushed. Test installation, Back exit, playback and proxy startup, quality switching, chat and colour keys, on screen keyboard, Spanish Auto language, and settings and Favourites persistence before release.
