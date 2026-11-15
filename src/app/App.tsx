import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { KickApi } from '../api/types';
import { createTranslator, resolveLanguage } from '../i18n/strings';
import type { Settings, SettingsStore } from '../settings/settings';
import { FocusManager } from '../nav/focus';
import { isDirection, toAction } from '../nav/keys';
import { AppContext, type ActionHandler, type AppServices } from './context';
import type { Route } from './routes';
import { renderScreen } from './screens';

export interface AppProps {
  api: KickApi;
  settings: SettingsStore;
  /** The TV language, for example `es-ES`. Language Auto follows it. */
  tvLanguage: string;
  exit: () => void;
  now?: () => number;
}

function isTextInput(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

export function App({ api, settings: store, tvLanguage, exit, now = Date.now }: AppProps) {
  const [settings, setSettings] = useState<Settings>(() => store.get());
  useEffect(() => {
    setSettings(store.get());
    return store.subscribe(setSettings);
  }, [store]);
  const language = resolveLanguage(settings.language, tvLanguage);
  const t = useMemo(() => createTranslator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [toast, setToast] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const screenHandler = useRef<ActionHandler | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const exitRef = useRef(exit);
  exitRef.current = exit;

  // One FocusManager for the App's life, so a language change keeps focus where it is.
  const focusRef = useRef<FocusManager | null>(null);
  if (!focusRef.current) focusRef.current = new FocusManager(() => screenRef.current);

  const services = useMemo<AppServices>(() => {
    const focus = focusRef.current!;
    return {
      api,
      t,
      now,
      focus,
      settings,
      setSetting: (key, value) => store.set(key, value),
      screenHandler,
      push: (route) => setStack((s) => s.concat([route])),
      back: () => {
        if (stackRef.current.length > 1) setStack((s) => s.slice(0, -1));
        else exitRef.current();
      },
      exit: () => exitRef.current(),
      toast: (text, ms = 2000) => {
        window.clearTimeout(toastTimer.current);
        setToast(text);
        toastTimer.current = window.setTimeout(() => setToast(null), ms);
      },
    };
  }, [api, t, now, settings, store]);

  // Keep focus valid whenever the screen content changes (loading, error, data).
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    services.focus.ensure();
    const observer = new MutationObserver(() => services.focus.ensure());
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [services]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTextInput(e.target) && e.key && e.key.length === 1) return;
      const action = toAction(e);
      if (!action) return;
      e.preventDefault();
      const handler = screenHandler.current;
      if (handler && handler(action)) return;
      if (isDirection(action)) services.focus.move(action);
      else if (action === 'ok') services.focus.activate();
      else if (action === 'back') services.back();
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(toastTimer.current);
    };
  }, [services]);

  const route = stack[stack.length - 1];
  return (
    <AppContext.Provider value={services}>
      <div class="screen" ref={screenRef}>
        {renderScreen(route)}
      </div>
      {toast ? <div class="toast">{toast}</div> : null}
    </AppContext.Provider>
  );
}
