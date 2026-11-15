import type { Livestream } from '../api/types';
import { useApp } from './context';

/**
 * The one "open Livestream" action. Every Livestream tile (Home, Category, later Search) calls this on OK,
 * so playback (ticket 03) wires up in one place.
 */
export function useOpenLivestream(): (livestream: Livestream) => void {
  useApp();
  return () => {
    // Ticket 03 replaces this with opening the Playback screen.
  };
}
