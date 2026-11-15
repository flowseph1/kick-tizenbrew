# 06: Favourites with Watch Count

**What to build:** The Viewer adds or removes a Favourite with the yellow key (on any Livestream or Channel tile, or during playback) or with the `Favourite` button in the Info Bar. Home shows a Favourites row at the top: live Favourites first, then offline Favourites greyed out. Each group is sorted by Watch Count, highest first; ties put the most recently added Favourite first. Each time a Livestream of a Favourite starts to play, from any screen, its Watch Count goes up by 1. Removing a Favourite deletes its Watch Count. Live status refreshes every 60 s while Home is visible. Selecting an offline Favourite shows "Offline". Favourites stay on the TV.

See `.scratch/kick-module/spec.md` (Favourites and Watch Count, Home) and `GLOSSARY.md`.

**Blocked by:** 05

**Status:** resolved

- [ ] Yellow key and the `Favourite` button add and remove a Favourite, with visible feedback.
- [ ] The Favourites row is hidden when there are no Favourites.
- [ ] Order: live before offline; each by Watch Count desc; ties by most recently added.
- [ ] Watch Count increments on each playback start of a Favourite, from any screen.
- [ ] Offline Favourites are greyed out and show "Offline" on OK.
- [ ] Live status refreshes every 60 s on Home.
- [ ] Favourites survive a restart of the Module; a storage failure does not crash it.
- [ ] Vitest covers ordering and Watch Count rules.

## Verification

Integrated with Chat on kick-module-v1. All 210 tests, typecheck, build and syntax checks pass. App tests cover Favourites and store rules. TV remote behaviour and persistence on a real TV remain unverified; acceptance boxes remain open for hardware verification.
