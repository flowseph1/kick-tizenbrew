import type { TizenVersion } from './route';
import type { PlayerFactory } from './types';

/** Platform pieces a PlaybackSession needs, chosen once at boot (see main.tsx). */
export interface PlaybackDeps {
  tizen: TizenVersion | null;
  createPlayer: PlayerFactory;
  proxyReady: () => Promise<boolean>;
  /** GET a URL as text; rejects on a network error or a non 2xx answer. Reads the master for the Quality list. */
  fetchText: (url: string) => Promise<string>;
}
