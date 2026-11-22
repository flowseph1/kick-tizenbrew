import type { SocketFactory } from '../chat/connection';
import type { TizenVersion } from './route';
import type { PlayerFactory } from './types';

/** Platform pieces a PlaybackSession needs, chosen once at boot (see main.tsx). */
export interface PlaybackDeps {
  tizen: TizenVersion | null;
  createPlayer: PlayerFactory;
  proxyReady: () => Promise<boolean>;
  /** GET a URL as text; rejects on a network error or a non 2xx answer. Reads the master for the Quality list. */
  fetchText: (url: string) => Promise<string>;
  /** Opens a WebSocket (the Chat Overlay's Kick chat connection). */
  createSocket: SocketFactory;
  /** Platform facts for the playback error screen: engine, Tizen version, page origin. */
  describe?: () => string;
}
