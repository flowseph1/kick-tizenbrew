# Own app module instead of wrapping tizen.kick.com

The Module is a TizenBrew `app` module with its own UI, not a `mods` module that injects into Kick's own TV site at `https://tizen.kick.com`. We tested the `mods` approach first (spike 01): the site's Next.js bundles use `?.` and `??`, which do not parse on Chromium 69 and 76, so on 2020 and 2021 TVs the page renders but never becomes interactive. That site is also unreleased and Kick can change it at any time. Our own module lets us choose the shipped syntax and support Tizen 5.5 and newer.

## Consequences

- Playback cannot use the Kick web player: `player.kick.com` has the same syntax problem, and the video CDN rejects cross origin requests from the module origin (`127.0.0.1:8081`).
- The official Kick API (`api.kick.com`) returns no playback URLs and needs a client secret, so the Module uses the unofficial `kick.com/api` endpoints. This is a grey area under Kick's terms. The Module stays read only, has no sign in, and states that it is not affiliated with Kick.
- If Kick ships a Samsung app that runs on older TVs, revisit this decision.
