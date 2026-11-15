import { render } from 'preact';
import { createKickApi } from './api/kick';
import { App } from './app/App';
import { AvPlayPlayer, type AvPlayApi } from './player/avplay';
import type { PlaybackDeps } from './player/deps';
import { HlsJsPlayer } from './player/hlsjs';
import { pickEngine, waitForProxy } from './player/pick';
import { tizenVersion } from './player/route';
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
};

render(
  <App api={api} settings={settings} tvLanguage={tvLanguage()} exit={exitToTizenBrew} playback={playback} />,
  document.getElementById('app')!,
);
