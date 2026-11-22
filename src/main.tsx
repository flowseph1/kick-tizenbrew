import { render } from 'preact';
import { createKickApi } from './api/kick';
import type { ChatSocket } from './chat/connection';
import { App } from './app/App';
import { AvPlayPlayer, type AvPlayApi } from './player/avplay';
import type { PlaybackDeps } from './player/deps';
import { HlsJsPlayer } from './player/hlsjs';
import { pickEngine, waitForProxy } from './player/pick';
import { tizenVersion } from './player/route';
import { createFavouritesStore } from './favourites/favourites';
import { createSettingsStore } from './settings/settings';
import { browserStorage } from './storage/storage';

// TizenBrew opened this page with location.href, so its own UI is the previous history entry.
function exitToTizenBrew() {
  history.back();
}

// The TV language for Language Auto. TizenBrew pages do not get `tizen.systeminfo` (see the
// research notes), and the TV browser reports the menu language in navigator.language.
function tvLanguage(): string {
  try {
    const nav = navigator as Navigator & { languages?: string[] };
    return (nav.languages && nav.languages[0]) || nav.language || '';
  } catch (e) {
    return '';
  }
}

const api = createKickApi((url) => fetch(url));
const settings = createSettingsStore(browserStorage());
const favourites = createFavouritesStore(browserStorage());

// AVPlay when the page can reach webapis.avplay, else <video> + hls.js (see the spec, Playback).
const win = window as unknown as { webapis?: { avplay?: AvPlayApi } };
const engine = pickEngine(win);
let proxyUp = false;
const playback: PlaybackDeps = {
  tizen: tizenVersion(navigator.userAgent),
  createPlayer:
    engine === 'avplay'
      ? (emit) => new AvPlayPlayer(win.webapis!.avplay!, emit)
      : (emit) => new HlsJsPlayer(emit),
  proxyReady: () =>
    proxyUp ? Promise.resolve(true) : waitForProxy((url) => fetch(url)).then((ok) => (proxyUp = ok)),
  fetchText: (url) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.text();
    }),
  createSocket: (url) => new WebSocket(url) as unknown as ChatSocket,
  describe: () => {
    const v = tizenVersion(navigator.userAgent);
    return (
      'engine ' + engine + ', tizen ' + (v ? v.major + '.' + v.minor : 'none') + ', page ' + location.origin
    );
  },
};

render(
  <App
    api={api}
    settings={settings}
    favourites={favourites}
    tvLanguage={tvLanguage()} exit={exitToTizenBrew} playback={playback} />,
  document.getElementById('app')!,
);
