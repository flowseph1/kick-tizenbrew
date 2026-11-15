import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Channel, SearchResults } from '../api/types';
import { useApp, useScreenActions } from '../app/context';
import { createDebounce } from '../app/debounce';
import { useOpenLivestream } from '../app/openLivestream';
import { CategoryTile } from '../components/CategoryTile';
import { ChannelTile } from '../components/ChannelTile';
import { ErrorScreen } from '../components/ErrorScreen';
import { Row } from '../components/Row';

/** The search runs this long after the last key press. There is no confirm step. */
export const SEARCH_DELAY_MS = 400;

/** Samsung on screen keyboard keys. They are not registered keys, so the App never maps them. */
const IME_DONE = 65376;
const IME_CANCEL = 65385;

type State =
  | { status: 'idle' }
  | { status: 'loading'; word: string }
  | { status: 'error'; word: string }
  | { status: 'ready'; word: string; results: SearchResults };

/**
 * An input that opens the TV keyboard, and two result rows: Channels and Categories.
 * Results are not filtered here; the Content Filter (ticket 11) filters them in this screen.
 * Back (the App default) returns to Home.
 */
export function SearchScreen() {
  const app = useApp();
  const { api, t } = app;
  const open = useOpenLivestream();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const run = useRef(0);

  function search(word: string) {
    const id = ++run.current;
    setState({ status: 'loading', word });
    api.search(word).then(
      (results) => { if (id === run.current) setState({ status: 'ready', word, results }); },
      () => { if (id === run.current) setState({ status: 'error', word }); },
    );
  }
  const searchRef = useRef(search);
  searchRef.current = search;

  const debounce = useMemo(() => createDebounce<string>(SEARCH_DELAY_MS, (w) => searchRef.current(w)), []);

  useEffect(() => {
    // Real DOM focus on the input opens the Samsung keyboard.
    if (inputRef.current) inputRef.current.focus();
    return () => {
      debounce.cancel();
      run.current++;
    };
  }, [debounce]);

  function onInput(value: string) {
    setText(value);
    const word = value.trim();
    if (!word) {
      debounce.cancel();
      run.current++;
      setState({ status: 'idle' });
      return;
    }
    debounce.call(word);
  }

  function typing(): boolean {
    return !!inputRef.current && document.activeElement === inputRef.current;
  }

  /** Closes the keyboard and puts focus on the first result, if there is one. */
  function leaveInput(): boolean {
    if (inputRef.current) inputRef.current.blur();
    const first = resultsRef.current ? resultsRef.current.querySelector<HTMLElement>('[data-focus]') : null;
    if (!first) return false;
    app.focus.set(first);
    return true;
  }

  useScreenActions((action) => {
    if (!typing()) return false;
    if (action === 'down' || action === 'ok') {
      leaveInput();
      return true;
    }
    // Left and right edit the text; up has nowhere to go.
    return action === 'up' || action === 'left' || action === 'right';
  });

  function openChannel(channel: Channel) {
    if (!channel.isLive) {
      app.toast(t('search.offline'));
      return;
    }
    // Search does not carry the Livestream (no title or viewers), so load it before playing.
    api.channelLivestream(channel.slug).then(
      (ls) => (ls ? open(ls) : app.toast(t('search.offline'))),
      () => app.toast(t('error.title')),
    );
  }

  if (state.status === 'error') {
    const word = state.word;
    return <ErrorScreen onRetry={() => search(word)} />;
  }

  return (
    <div class="search">
      <header class="top-bar">
        <h1 class="screen-title">{t('search.title')}</h1>
      </header>
      <input
        ref={inputRef}
        class="search-input"
        type="text"
        value={text}
        placeholder={t('search.placeholder')}
        data-focus
        data-autofocus
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.keyCode === IME_DONE || e.keyCode === IME_CANCEL) leaveInput();
        }}
        onClick={(e) => (e.currentTarget as HTMLInputElement).focus()}
      />
      <div class="search-results" ref={resultsRef}>
        {state.status === 'loading' ? <p class="status">{t('loading')}</p> : null}
        {state.status === 'ready' ? <Results word={state.word} results={state.results} onChannel={openChannel} /> : null}
      </div>
    </div>
  );
}

function Results({
  word,
  results,
  onChannel,
}: {
  word: string;
  results: SearchResults;
  onChannel: (c: Channel) => void;
}) {
  const app = useApp();
  const { t } = app;
  if (results.channels.length === 0 && results.categories.length === 0) {
    return <p class="status">{t('search.noResults', { word })}</p>;
  }
  return (
    <div>
      {results.channels.length > 0 ? (
        <Row title={t('search.channels')}>
          {results.channels.map((c) => (
            <ChannelTile key={c.id} channel={c} onSelect={() => onChannel(c)} />
          ))}
        </Row>
      ) : null}
      {results.categories.length > 0 ? (
        <Row title={t('search.categories')}>
          {results.categories.map((c) => (
            <CategoryTile key={c.id} category={c} onSelect={() => app.push({ name: 'category', category: c })} />
          ))}
        </Row>
      ) : null}
    </div>
  );
}
