// Turns a keydown into a remote action. TV key codes first, then desktop keys for development.
// The colour and media keys only reach the page because package.json `keys` registers them.

export type Action =
  | 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'
  | 'red' | 'green' | 'yellow' | 'blue'
  | 'play' | 'pause' | 'playPause' | 'stop';

export interface KeyLike {
  keyCode?: number;
  key?: string;
}

const BY_CODE: { [code: number]: Action } = {
  37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok',
  10009: 'back',
  403: 'red', 404: 'green', 405: 'yellow', 406: 'blue',
  10252: 'playPause', 415: 'play', 19: 'pause', 413: 'stop',
};

// Desktop Chrome only. Letters must be ignored while a text input has focus (see App).
const BY_KEY: { [key: string]: Action } = {
  ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', Enter: 'ok',
  Escape: 'back', Backspace: 'back',
  r: 'red', g: 'green', y: 'yellow', b: 'blue',
  ' ': 'playPause',
};

export function toAction(e: KeyLike): Action | null {
  if (e.keyCode && BY_CODE[e.keyCode]) return BY_CODE[e.keyCode];
  if (e.key && BY_KEY[e.key]) return BY_KEY[e.key];
  return null;
}

export function isDirection(a: Action): a is 'up' | 'down' | 'left' | 'right' {
  return a === 'up' || a === 'down' || a === 'left' || a === 'right';
}
