import type { Livestream } from '../api/types';
import { useApp } from './context';

/**
 * The one "open Livestream" action. Every Livestream tile (Home, Category, Search, Favourites) calls this on OK.
 * It counts the start for the Channel's Watch Count (Favourites only) and opens the Playback screen.
 * It never applies the Content Filter, so a Favourite always plays.
 */
export function useOpenLivestream(): (livestream: Livestream) => void {
  const app = useApp();
  return (livestream) => {
    app.recordWatch(livestream.channelSlug);
    app.push({ name: 'playback', slug: livestream.channelSlug });
  };
}
