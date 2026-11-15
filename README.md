# Kick for TizenBrew

Watch Kick livestreams on Samsung TVs with TizenBrew. Not affiliated with Kick.

## Install

Requires TizenBrew and a Samsung TV with Tizen 5.0 (2019) or newer.

1. Open TizenBrew and its module management screen.
2. Add `gh/flowseph1/kick-tizenbrew`.
3. Open Kick from the module list.

The first release is awaiting testing on a real TV. Desktop tests do not confirm TV compatibility.

## Remote keys

| Key | Action |
| --- | --- |
| Arrows | Move focus |
| OK | Select a tile; during playback, show the Info Bar |
| Green | Show or hide chat during playback |
| Yellow | Add or remove the focused channel or playing channel from Favourites |
| Back | Close playback overlays, then return to the previous screen; on Home, press twice within 2 seconds to exit |
| Play / Pause / Play-Pause | Control playback |
| Stop | Leave playback |

The Info Bar has Favourite, Chat and Quality buttons. Quality offers Auto and available stream variants. Chat connects only while its overlay is open.

Home shows live Favourites before offline Favourites, ordered by watch count. Settings offers English, Spanish, automatic language selection, and a content filter. The filter does not hide Favourites. Preferences and Favourites use local TV storage.

## Development

Run `npm ci`, then `npm test`, `npm run typecheck` and `npm run build`. Run `npm run dev` for desktop development. The build checks browser assets for Chromium 63 and the proxy service for Node 4.4.3 compatibility. Commit the generated `dist/` files for TizenBrew installation.
