// Our own domain types. The UI only ever sees these, never raw Kick JSON.

export interface Category {
  id: number;
  slug: string;
  name: string;
  /** Slug of the parent group, for example `games`, `irl` or `gambling`. */
  parentSlug: string;
  isMature: boolean;
  tags: string[];
}

export interface Livestream {
  id: number;
  channelSlug: string;
  channelName: string;
  channelAvatarUrl: string;
  title: string;
  viewerCount: number;
  isMature: boolean;
  thumbnailUrl: string;
  category: Category | null;
}

/** A Channel as `GET /api/v2/channels/{slug}` gives it: what playback and chat need. */
export interface Channel {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string;
  /** Chat: Pusher channel `chatrooms.{chatroomId}.v2`. */
  chatroomId: number;
  /** Master playlist with a `?token=` that expires about 10 min later: fetch the Channel again before each open. */
  playbackUrl: string;
  /** Null when the Channel is offline. */
  livestream: Livestream | null;
}

/** Everything the Module reads from Kick. Later tickets add methods here. */
export interface KickApi {
  topLivestreams(): Promise<Livestream[]>;
  channel(slug: string): Promise<Channel>;
}
