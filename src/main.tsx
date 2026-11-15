import { render } from 'preact';
import { createKickApi } from './api/kick';
import { App } from './app/App';
import { createTranslator } from './i18n/strings';

// TizenBrew opened this page with location.href, so its own UI is the previous history entry.
function exitToTizenBrew() {
  history.back();
}

const api = createKickApi((url) => fetch(url));
const t = createTranslator('en');

render(<App api={api} t={t} exit={exitToTizenBrew} />, document.getElementById('app')!);
