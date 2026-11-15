import type { Engine } from './route';

/** What a player tells the session. The session owns the rules (end, reconnect, give up). */
export type PlayerEvent =
  | { type: 'playing' }
  | { type: 'ended' }
  | { type: 'error'; detail: string };

/**
 * One interface, two implementations: `AvPlayPlayer` (webapis.avplay, on the TV when it exists) and
 * `HlsJsPlayer` (`<video>` + hls.js, desktop and the TV fallback). See the spec, Playback.
 */
export interface Player {
  readonly engine: Engine;
  /** Opens `url` and starts playing. Calling it again reopens (reconnect, or a Quality change in ticket 05). */
  open(url: string): void;
  play(): void;
  pause(): void;
  /** Stops and frees the player. It sends no more events. */
  close(): void;
}

export type PlayerFactory = (onEvent: (e: PlayerEvent) => void) => Player;
