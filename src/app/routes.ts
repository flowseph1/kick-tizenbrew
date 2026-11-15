// In memory screen routes. No history.pushState: Back from Home must reach TizenBrew with history.back().
// Later tickets add routes here, for example { name: 'playback'; slug: string } or { name: 'category'; slug: string },
// and register their screen in `screens.tsx`.

export type Route = { name: 'home' } | { name: 'playback'; slug: string };

export type RouteName = Route['name'];
