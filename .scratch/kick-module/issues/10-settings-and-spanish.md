# 10: Settings and Spanish

**What to build:** The Viewer selects `Settings` in the top bar. The Settings screen has Language (Auto, English, Español), the Module version and the note "Not affiliated with Kick". The whole UI is available in English and Spanish. Auto uses the TV language and falls back to English. The choice stays on the TV.

See `.scratch/kick-module/spec.md` (Settings, Languages).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `Settings` opens from the top bar; Back returns to Home.
- [ ] Language changes the UI at once and survives a restart.
- [ ] Auto picks Spanish on a Spanish TV and English otherwise.
- [ ] Version and disclaimer show.
- [ ] Vitest checks that `en` and `es` have the same keys.
