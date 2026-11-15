import type { Livestream } from '../api/types';
import { useApp } from './context';

/**
 * The one "open Livestream" action. Every Livestream tile (Home, Category, Search) calls this on OK.
 * It opens the Playback screen for the Livestream's Channel.
 */
export function useOpenLivestream(): (livestream: Livestream) => void {
  const app = useApp();
  return (livestream) => app.push({ name: 'playback', slug: livestream.channelSlug });
}
