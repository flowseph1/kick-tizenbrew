# 11: Content Filter

**What to build:** Settings has a Content Filter switch, off by default. When on, the Module hides gambling Categories and Livestreams that Kick marks as mature. It applies to Top Livestreams, the Categories row, the Category screen and Search. It never hides Favourites. The setting stays on the TV.

See `.scratch/kick-module/spec.md` (Content Filter) and `GLOSSARY.md`.

**Blocked by:** 08, 09, 10

**Status:** ready-for-agent

- [ ] The Content Filter switch shows in Settings, off by default, and survives a restart.
- [ ] When on, gambling Categories and mature Livestreams are hidden in all listed places.
- [ ] Favourites are never hidden.
- [ ] The gambling Category list lives in one place.
- [ ] Vitest covers the filter rules.
