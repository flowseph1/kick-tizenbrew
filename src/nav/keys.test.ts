import { describe, expect, it } from 'vitest';
import { toAction } from './keys';

describe('toAction', () => {
  it('maps the TV remote key codes', () => {
    expect(toAction({ keyCode: 37 })).toBe('left');
    expect(toAction({ keyCode: 38 })).toBe('up');
    expect(toAction({ keyCode: 39 })).toBe('right');
    expect(toAction({ keyCode: 40 })).toBe('down');
    expect(toAction({ keyCode: 13 })).toBe('ok');
    expect(toAction({ keyCode: 10009 })).toBe('back');
    expect(toAction({ keyCode: 403 })).toBe('red');
    expect(toAction({ keyCode: 404 })).toBe('green');
    expect(toAction({ keyCode: 405 })).toBe('yellow');
    expect(toAction({ keyCode: 406 })).toBe('blue');
    expect(toAction({ keyCode: 10252 })).toBe('playPause');
    expect(toAction({ keyCode: 415 })).toBe('play');
    expect(toAction({ keyCode: 19 })).toBe('pause');
    expect(toAction({ keyCode: 413 })).toBe('stop');
  });

  it('maps desktop keys for development', () => {
    expect(toAction({ key: 'Escape' })).toBe('back');
    expect(toAction({ key: 'Backspace' })).toBe('back');
    expect(toAction({ key: 'ArrowRight' })).toBe('right');
    expect(toAction({ key: 'Enter' })).toBe('ok');
    expect(toAction({ key: 'y' })).toBe('yellow');
    expect(toAction({ key: ' ' })).toBe('playPause');
  });

  it('ignores other keys', () => {
    expect(toAction({ keyCode: 65 })).toBeNull();
    expect(toAction({ key: 'q' })).toBeNull();
  });
});
