// The one adapter between the unofficial kick.com API and our own types.
// Endpoints are recorded in `.scratch/kick-module/spec.md` (Data source).
import type { Category, KickApi, Livestream } from './types';

export const KICK_BASE = 'https://kick.com';
const TOP_LIMIT = 24;
/** Kick caps `limit` at 32 on `/stream/livestreams`. */
const CATEGORY_LIMIT = 32;

/** The subset of `fetch` the adapter needs, so tests can pass a fake. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class KickApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'KickApiError';
    this.status = status;
    // Keep instanceof working when TypeScript targets ES5 style classes.
    Object.setPrototypeOf(this, KickApiError.prototype);
  }
}

type Json = { [key: string]: any };

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/** Maps a Kick subcategory (our Category) from lists, Livestreams, `categories/top`, `subcategories` or search. */
export function mapCategory(raw: Json | null | undefined): Category | null {
  if (!raw || typeof raw !== 'object') return null;
  const parent = raw.category || {};
  // `categories/top` and search send banner.src; `subcategories` sends banner.url.
  const banner = raw.banner || {};
  return {
    id: num(raw.id),
    slug: str(raw.slug),
    name: str(raw.name),
    parentSlug: str(parent.slug),
    isMature: raw.is_mature === true,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') : [],
    viewerCount: num(raw.viewers),
    bannerUrl: str(banner.src) || str(banner.url),
  };
}

/** Maps one item of `GET /stream/livestreams/{lang}`. */
export function mapStreamListItem(raw: Json): Livestream {
  const channel = raw.channel || {};
  const user = channel.user || {};
  const thumb = raw.thumbnail || {};
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  return {
    id: num(raw.id),
    channelSlug: str(channel.slug),
    channelName: str(user.username) || str(channel.slug),
    channelAvatarUrl: str(user.profilepic),
    title: str(raw.session_title),
    viewerCount: num(raw.viewer_count),
    isMature: raw.is_mature === true,
    thumbnailUrl: str(thumb.src),
    category: mapCategory(categories[0]),
  };
}

export function createKickApi(fetchFn: FetchLike, base: string = KICK_BASE): KickApi {
  async function getJson(path: string): Promise<Json> {
    let res;
    try {
      res = await fetchFn(base + path);
    } catch (e) {
      throw new KickApiError('Network error: ' + String(e), 0);
    }
    if (!res.ok) throw new KickApiError('Kick answered ' + res.status, res.status);
    try {
      return (await res.json()) as Json;
    } catch (e) {
      throw new KickApiError('Invalid JSON from Kick', res.status);
    }
  }

  async function streamList(query: string): Promise<Livestream[]> {
    const body = await getJson('/stream/livestreams/en?' + query);
    if (!body || !Array.isArray(body.data)) throw new KickApiError('Unexpected Livestream list shape', 200);
    return body.data.map(mapStreamListItem);
  }

  return {
    topLivestreams() {
      return streamList('limit=' + TOP_LIMIT + '&sort=desc&page=1');
    },
    async topCategories() {
      const body = await getJson('/api/v1/categories/top');
      if (!Array.isArray(body)) throw new KickApiError('Unexpected Category list shape', 200);
      return body.map(mapCategory).filter((c): c is Category => c !== null);
    },
    categoryLivestreams(slug) {
      return streamList('limit=' + CATEGORY_LIMIT + '&sort=desc&page=1&subcategory=' + encodeURIComponent(slug));
    },
  };
}
