// Remote focus for the whole Module.
//
// Any element with a `data-focus` attribute inside the current scope can take focus.
// Focus is shown with the `.focused` class (Chromium 63 has no :focus-visible).
// OK clicks the focused element, so components use ordinary onClick handlers.
// `data-autofocus` marks the element a screen wants focused first.
// Overlays (Info Bar, Quality list, Chat) can call setScope() to keep arrows inside them,
// and restore the previous scope when they close.
import { pickNext, type Direction, type Rect } from './spatial';

export const FOCUSED_CLASS = 'focused';

export class FocusManager {
  private current: HTMLElement | null = null;
  /** True while `current` was picked only because no `data-autofocus` element existed. */
  private fallback = false;
  private scope: () => HTMLElement | null;

  constructor(scope: () => HTMLElement | null) {
    this.scope = scope;
  }

  setScope(scope: () => HTMLElement | null): () => HTMLElement | null {
    const previous = this.scope;
    this.scope = scope;
    this.ensure();
    return previous;
  }

  focused(): HTMLElement | null {
    return this.current;
  }

  focusables(): HTMLElement[] {
    const root = this.scope();
    if (!root) return [];
    const list = root.querySelectorAll<HTMLElement>('[data-focus]');
    return Array.prototype.slice.call(list);
  }

  set(el: HTMLElement | null): void {
    if (this.current === el) return;
    if (this.current) this.current.classList.remove(FOCUSED_CLASS);
    this.current = el;
    if (!el) return;
    el.classList.add(FOCUSED_CLASS);
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  /** Keeps focus on something visible: call after the screen content changes. */
  ensure(): void {
    const all = this.focusables();
    const root = this.scope();
    const preferred = root ? root.querySelector<HTMLElement>('[data-autofocus]') : null;
    if (this.current && all.indexOf(this.current) !== -1) {
      // A fallback pick (for example Search in the top bar while rows load) gives way to the
      // element the screen wants first, until the Viewer moves focus.
      if (!(this.fallback && preferred && preferred !== this.current)) {
        // Preact may have re-rendered the class attribute away.
        this.current.classList.add(FOCUSED_CLASS);
        return;
      }
    } else {
      this.current = null;
    }
    this.set(preferred || all[0] || null);
    this.fallback = !preferred;
  }

  move(dir: Direction): boolean {
    this.ensure();
    if (!this.current) return false;
    const others = this.focusables().filter((el) => el !== this.current);
    const rects: Rect[] = others.map((el) => el.getBoundingClientRect());
    const i = pickNext(this.current.getBoundingClientRect(), rects, dir);
    if (i === -1) return false;
    this.set(others[i]);
    this.fallback = false;
    return true;
  }

  activate(): boolean {
    this.ensure();
    if (!this.current) return false;
    this.current.click();
    return true;
  }
}
