import { render } from 'preact';
import { createKickApi } from './api/kick';
import { App } from './app/App';
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

render(
  <App api={api} settings={settings} tvLanguage={tvLanguage()} exit={exitToTizenBrew} />,
  document.getElementById('app')!,
);
