import { createContext } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import type { KickApi } from '../api/types';
import type { Favourite, FavouriteChannel } from '../favourites/favourites';
import type { Translate } from '../i18n/strings';
import type { Action } from '../nav/keys';
import type { FocusManager } from '../nav/focus';
import type { PlaybackDeps } from '../player/deps';
import type { SettingKey, Settings } from '../settings/settings';
import type { Route } from './routes';

/** Returns true when the screen handled the action, so the App skips its default. */
export type ActionHandler = (action: Action) => boolean;

export interface AppServices {
  api: KickApi;
  t: Translate;
  now: () => number;
  focus: FocusManager;
  /** What the Playback screen needs to make a player (real ones from main.tsx, fakes in tests). */
  playback: PlaybackDeps;
  /** The Viewer's current settings. Screens re-render when one changes. */
  settings: Settings;
  /** Changes a setting and saves it on the TV (in memory only if storage fails). */
  setSetting<K extends SettingKey>(key: K, value: Settings[K]): void;
  /** The Viewer's Favourites, in the order they were added. Screens re-render when they change. */
  favourites: Favourite[];
  isFavourite(slug: string): boolean;
  /** Adds or removes the Favourite and shows a toast that says which. */
  toggleFavourite(channel: FavouriteChannel): void;
  /** A Livestream of this Channel starts to play: a Favourite's Watch Count goes up by 1. */
  recordWatch(slug: string): void;
  /** Opens a screen on top of the current one. */
  push(route: Route): void;
  /** Returns to the previous screen. */
  back(): void;
  /** Leaves the Module and returns to TizenBrew. */
  exit(): void;
  /** Shows a short message at the bottom of the screen. */
  toast(text: string, ms?: number): void;
  /** Internal: the active screen's key handler. Use useScreenActions(). */
  screenHandler: { current: ActionHandler | null };
}

export const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp() outside <App>');
  return app;
}

/** Lets the visible screen see remote actions before the App's defaults (arrows, OK, Back). */
export function useScreenActions(handler: ActionHandler): void {
  const app = useApp();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const fn: ActionHandler = (a) => latest.current(a);
    app.screenHandler.current = fn;
    return () => {
      if (app.screenHandler.current === fn) app.screenHandler.current = null;
    };
  }, [app]);
}
