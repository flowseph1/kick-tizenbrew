// In memory screen routes. No history.pushState: Back from Home must reach TizenBrew with history.back().
// Add a variant here and register its screen in `screens.tsx`.
import type { Category } from '../api/types';

export type Route =
  | { name: 'home' }
  /** Carries the whole Category so the screen shows its name (and ticket 11 can filter) without a fetch. */
  | { name: 'category'; category: Category }
  | { name: 'settings' };

export type RouteName = Route['name'];
