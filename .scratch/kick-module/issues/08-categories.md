# 08: Categories row and Category screen

**What to build:** Home shows a Categories row below Top Livestreams. The Viewer selects a Category and presses OK. A grid of the Livestreams in that Category opens, sorted by viewers. OK on a tile plays the Livestream. Back returns to Home.

See `.scratch/kick-module/spec.md` (Home, Category).

**Blocked by:** 02

**Status:** resolved

- [x] Home shows a Categories row with images and names.
- [x] OK opens the Category screen with a grid of its Livestreams.
- [ ] Arrow navigation works in the grid; OK plays the Livestream (once 03 is done).
- [x] Back returns to Home.
- [x] The endpoint for Category Livestreams is found and recorded in the spec.
- [x] Vitest covers the Category mapping.

## Comments

### Implementation (ticket-08 branch)

Verified without a TV: Vitest covers the adapter (`topCategories` from the recorded `categories-top.json`, the `banner.url` shape from `subcategories.json`, `categoryLivestreams` from `stream-livestreams-category.json`, URL and slug encoding, error cases) and the App flow in happy-dom (Categories row with art and names, OK opens the Category grid for that slug, arrows across and down the grid, empty message, error screen with Retry, Back returns to Home without the exit hint). Both endpoints were checked live with curl and `Origin: http://127.0.0.1:8081`: 200, Origin reflected, 32 items sorted by viewers, all in the asked Category. `npm run build` passes the Chromium 63 gate.

Not verified, so the box stays unchecked:
- "OK plays the Livestream": arrow navigation in the grid is done and tested, but playback is ticket 03. Every Livestream tile (Home and Category) calls the single `useOpenLivestream()` in `src/app/openLivestream.ts`, which is a no op until 03 fills it in. When 03 merges, it should implement playback there (and drop any separate `onSelect` it added to Home tiles).
- The layout was not viewed on the test TV or in desktop Chrome; only happy-dom.

### Notes for later tickets

- Route: `{ name: 'category', category: Category }` carries the whole Category, so Search (09) opens it with `app.push({ name: 'category', category })` from a mapped search result. `mapCategory` already reads the search banner shape (`banner.src`).
- `Category` now has `viewerCount` and `bannerUrl` besides `slug`, `name`, `parentSlug`, `isMature`, `tags`. For the Content Filter (11): gambling is `parentSlug === 'gambling'` or `tags` includes `Gambling` (Slots & Casino is in `test/fixtures/categories-top.json`); mature Livestreams have `Livestream.isMature`, and `Livestream.category` keeps its Category. Filter in `Home.tsx` (both rows) and `screens/Category.tsx`; the API stays unfiltered.
- Home shows the error screen if either Top Livestreams or Categories fails; Retry reloads only the failed one.
