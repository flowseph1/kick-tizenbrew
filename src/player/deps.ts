import type { TizenVersion } from './route';
import type { PlayerFactory } from './types';

/** Platform pieces a PlaybackSession needs, chosen once at boot (see main.tsx). */
export interface PlaybackDeps {
  tizen: TizenVersion | null;
  createPlayer: PlayerFactory;
  proxyReady: () => Promise<boolean>;
}
