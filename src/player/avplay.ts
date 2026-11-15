// Player on `webapis.avplay`: a hardware video plane under the page. The HTML above it must be
// transparent (body.playing in styles.css). Reference: Samsung AVPlay API; usage after Replexo/kick-tizen.
import type { Quality } from './quality';
import type { Player, PlayerEvent } from './types';

export interface AvPlayListener {
  onbufferingstart?: () => void;
  onbufferingprogress?: (pct: number) => void;
  onbufferingcomplete?: () => void;
  oncurrentplaytime?: (ms: number) => void;
  onstreamcompleted?: () => void;
  onevent?: (type: string, data: string) => void;
  onerror?: (type: unknown) => void;
}

/** The part of `webapis.avplay` we use. */
export interface AvPlayApi {
  open(url: string): void;
  close(): void;
  stop(): void;
  play(): void;
  pause(): void;
  getState(): string;
  setListener(l: AvPlayListener): void;
  setDisplayRect(x: number, y: number, w: number, h: number): void;
  setDisplayMethod?(method: string): void;
  prepareAsync(ok: () => void, err: (e: unknown) => void): void;
}

const PLANE_ID = 'av-player';

export class AvPlayPlayer implements Player {
  readonly engine = 'avplay' as const;
  private av: AvPlayApi;
  private emit: (e: PlayerEvent) => void;
  private doc: Document;
  /** Bumped on every open/close, so callbacks from an older stream are ignored. */
  private gen = 0;

  constructor(av: AvPlayApi, emit: (e: PlayerEvent) => void, doc: Document = document) {
    this.av = av;
    this.emit = emit;
    this.doc = doc;
  }

  private plane(): void {
    if (this.doc.getElementById(PLANE_ID)) return;
    const el = this.doc.createElement('object');
    el.id = PLANE_ID;
    el.setAttribute('type', 'application/avplayer');
    el.className = 'video-plane';
    this.doc.body.insertBefore(el, this.doc.body.firstChild);
  }

  private release(): void {
    try {
      const s = this.av.getState();
      if (s === 'PLAYING' || s === 'PAUSED' || s === 'READY') this.av.stop();
      if (this.av.getState() !== 'NONE') this.av.close();
    } catch (e) {
      // AVPlay throws on calls in the wrong state; the next open starts clean anyway.
    }
  }

  open(url: string): void {
    this.release();
    this.plane();
    const gen = ++this.gen;
    const emit = (e: PlayerEvent) => {
      if (gen === this.gen) this.emit(e);
    };
    try {
      this.av.open(url);
      this.av.setListener({
        onstreamcompleted: () => emit({ type: 'ended' }),
        onerror: (type) => emit({ type: 'error', detail: String(type) }),
      });
      this.av.setDisplayRect(0, 0, 1920, 1080);
      if (this.av.setDisplayMethod) this.av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      this.av.prepareAsync(
        () => {
          if (gen !== this.gen) return;
          this.av.play();
          emit({ type: 'playing' });
        },
        (err) => emit({ type: 'error', detail: String(err) }),
      );
    } catch (e) {
      emit({ type: 'error', detail: String(e) });
    }
  }

  /** AVPlay has no documented in place HLS variant switch: the session reopens at the variant URL. */
  setQuality(_quality: Quality | null): boolean {
    return false;
  }

  play(): void {
    try {
      this.av.play();
    } catch (e) {}
  }

  pause(): void {
    try {
      this.av.pause();
    } catch (e) {}
  }

  close(): void {
    this.gen++;
    this.release();
    const el = this.doc.getElementById(PLANE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}
