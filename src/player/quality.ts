// The Quality list: the variants of a Livestream's master playlist. Auto is not in the list; the UI
// adds it first, and `null` means Auto everywhere (session, players).

/** One variant (rendition) of the master playlist. */
export interface Quality {
  /** For example `1080p60` or `480p30`. */
  label: string;
  height: number;
  /** BANDWIDTH in bits per second. hls.js reports it as `level.bitrate`, so it identifies the level. */
  bandwidth: number;
  /** The variant's media playlist (absolute, on the CDN). */
  url: string;
}

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out[m[1]] = m[2].replace(/^"|"$/g, '');
  return out;
}

function label(height: number, fps: number, name: string, bandwidth: number): string {
  if (height) return height + 'p' + (fps ? Math.round(fps) : '');
  if (name) return name;
  return Math.round(bandwidth / 1000) + ' kbps';
}

/**
 * Reads the variants from a master playlist, best first. The label comes from RESOLUTION and
 * FRAME-RATE (Kick names its 480p30 variant "480p"), else the video group NAME. Duplicate labels keep the first.
 */
export function parseQualities(master: string): Quality[] {
  const names: Record<string, string> = {};
  const list: Quality[] = [];
  const lines = master.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.indexOf('#EXT-X-MEDIA:') === 0) {
      const a = attrs(line);
      if (a['TYPE'] === 'VIDEO' && a['GROUP-ID']) names[a['GROUP-ID']] = a['NAME'] || '';
    } else if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
      const a = attrs(line);
      let url = '';
      while (++i < lines.length) {
        const next = lines[i].trim();
        if (next && next.charAt(0) !== '#') {
          url = next;
          break;
        }
      }
      if (!url) continue;
      const res = /^(\d+)x(\d+)$/.exec(a['RESOLUTION'] || '');
      const height = res ? Number(res[2]) : 0;
      const bandwidth = Number(a['BANDWIDTH']) || 0;
      const q: Quality = {
        label: label(height, Number(a['FRAME-RATE']) || 0, names[a['VIDEO']] || '', bandwidth),
        height,
        bandwidth,
        url,
      };
      if (!list.some((x) => x.label === q.label)) list.push(q);
    }
  }
  return list.sort((x, y) => y.bandwidth - x.bandwidth);
}
