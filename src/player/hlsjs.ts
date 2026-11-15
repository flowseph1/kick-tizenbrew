// Player on `<video>` + hls.js (MSE). Desktop Chrome, and the TV when `webapis.avplay` is missing.
// hls.js/light: no subtitles, EME or alternate audio (the proxy strips subtitles anyway).
import Hls from 'hls.js/light';
import type { Quality } from './quality';
import type { Player, PlayerEvent } from './types';

export class HlsJsPlayer implements Player {
  readonly engine = 'hlsjs' as const;
  private emit: (e: PlayerEvent) => void;
  private doc: Document;
  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private gen = 0;
  /** The chosen Quality (null = Auto). Kept across reopens (reconnects) of this player. */
  private quality: Quality | null = null;

  constructor(emit: (e: PlayerEvent) => void, doc: Document = document) {
    this.emit = emit;
    this.doc = doc;
  }

  /** The hls.js instance of the open stream: `levels`, `currentLevel` (ticket 05 Quality, -1 = Auto). */
  get instance(): Hls | null {
    return this.hls;
  }

  private element(): HTMLVideoElement {
    if (this.video) return this.video;
    const v = this.doc.createElement('video');
    v.className = 'video-plane';
    v.autoplay = true;
    v.setAttribute('playsinline', '');
    this.doc.body.insertBefore(v, this.doc.body.firstChild);
    this.video = v;
    return v;
  }

  private destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  open(url: string): void {
    this.destroy();
    const gen = ++this.gen;
    const emit = (e: PlayerEvent) => {
      if (gen === this.gen) this.emit(e);
    };
    const video = this.element();
    video.onplaying = () => emit({ type: 'playing' });
    video.onended = () => emit({ type: 'ended' });

    if (!Hls.isSupported()) {
      // No MSE: let the platform's own HLS stack try (it gets the same proxied playlists).
      video.onerror = () => emit({ type: 'error', detail: 'video element error' });
      video.src = url;
      this.start(video);
      return;
    }
    video.onerror = null;

    const hls = new Hls({
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      maxBufferLength: 10,
      backBufferLength: 10,
      enableWorker: true,
    });
    this.hls = hls;
    let mediaRecoveries = 0;
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.applyQuality();
      this.start(video);
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
        mediaRecoveries++;
        hls.recoverMediaError();
        return;
      }
      // Network or anything else: the session reconnects with a fresh token, or gives up after 30 s.
      emit({ type: 'error', detail: data.type + ': ' + data.details });
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  /** In place: `currentLevel` flushes the buffer and loads the new level now; -1 is Auto (ABR). */
  setQuality(quality: Quality | null): boolean {
    this.quality = quality;
    if (this.hls && this.hls.levels && this.hls.levels.length) this.applyQuality();
    return true;
  }

  /** hls.js sorts levels by bitrate, so find the level by the variant's BANDWIDTH, else its height. */
  private applyQuality(): void {
    const hls = this.hls;
    if (!hls) return;
    const q = this.quality;
    let level = -1;
    if (q) {
      const levels = hls.levels || [];
      for (let i = 0; i < levels.length && level === -1; i++) if (levels[i].bitrate === q.bandwidth) level = i;
      for (let i = 0; i < levels.length && level === -1; i++) if (levels[i].height === q.height) level = i;
    }
    if (hls.currentLevel !== level) hls.currentLevel = level;
  }

  private start(video: HTMLVideoElement): void {
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  play(): void {
    if (this.video) this.start(this.video);
  }

  pause(): void {
    if (this.video) this.video.pause();
  }

  close(): void {
    this.gen++;
    this.destroy();
    const v = this.video;
    this.video = null;
    if (!v) return;
    v.onplaying = v.onended = v.onerror = null;
    v.pause();
    v.removeAttribute('src');
    v.load();
    if (v.parentNode) v.parentNode.removeChild(v);
  }
}
