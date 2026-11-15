# 11: Content Filter

**What to build:** Settings has a Content Filter switch, off by default. When on, the Module hides gambling Categories and Livestreams that Kick marks as mature. It applies to Top Livestreams, the Categories row, the Category screen and Search. It never hides Favourites. The setting stays on the TV.

See `.scratch/kick-module/spec.md` (Content Filter) and `GLOSSARY.md`.

**Blocked by:** 08, 09, 10

**Status:** resolved

- [x] The Content Filter switch shows in Settings, off by default, and survives a restart.
- [x] When on, gambling Categories and mature Livestreams are hidden in all listed places.
- [ ] Favourites are never hidden.
- [x] The gambling Category list lives in one place.
- [x] Vitest covers the filter rules.

## Comments

### Implementation (ticket-11 branch)

Verified without a TV, in Vitest:
- Rules (`src/filter/contentFilter.test.ts`): a Category is gambling when its group is `gambling`, it has the `Gambling` tag (any case), or its slug is in `GAMBLING_CATEGORY_SLUGS` (`slots`, `gambling`). In the recorded `categories-top.json` only `slots` matches; it also matches in `search-slots.json`. A mature Category that is not gambling stays. A Livestream is hidden when `isMature` is true or its Category is gambling. Off keeps everything.
- Setting (`src/settings/settings.test.ts`): `contentFilter` is off by default, stays on after a restart on the same storage, and a stored value that is not a boolean falls back to off.
- App flow in happy-dom (`src/app/App.test.tsx`): Settings shows Content Filter with Off and On (Off marked by default) and keeps On after a remount; Home hides mature and gambling Livestreams in Top Livestreams and gambling Categories in the Categories row, and refilters at once when the Viewer turns it on; the Category screen hides mature Livestreams; Search hides gambling Category results and says "No results" when the filter hid all of them.
- `npm run build` passes the Chromium 63 gate.

Not verified, so this box stays unchecked:
- "Favourites are never hidden": Favourites are ticket 06 and do not exist on this branch yet. Nothing here filters at the shared paths: the API adapter and `useOpenLivestream()` are unfiltered; only Home, the Category screen and Search call the filter. Ticket 06 must not call `src/filter/contentFilter.ts` for the Favourites row or when playing a Favourite.
- Restart persistence on a real TV uses `localStorage` (as ticket 10); tested only with an in memory storage. The Settings row was not viewed on the TV or in desktop Chrome.

Decisions:
- Search Channels carry no mature flag. With the filter on, OK on a live Channel still loads the Livestream with `channelLivestream()`; if that Livestream is hidden (mature or gambling) it is not played and the toast "Hidden by the Content Filter" shows. Channels stay in the results row because hiding them would need one request per Channel.
- Livestreams in a gambling Category are hidden too, not only `isMature` ones, so Top Livestreams does not show Slots streams that Kick did not flag.

### Notes for later tickets

- Rules: `isGamblingCategory`, `isHiddenLivestream`, `visibleCategories`, `visibleLivestreams` in `src/filter/contentFilter.ts`. Read the setting with `useApp().settings.contentFilter`.
- Strings: `settings.contentFilter`, `settings.contentFilter.hint`, `settings.off`, `settings.on`, `search.hidden`.
- Playback (03): when `useOpenLivestream()` gets filled in, keep it unfiltered so Favourites (06) can always play.
