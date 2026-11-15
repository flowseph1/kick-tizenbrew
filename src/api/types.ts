// Our own domain types. The UI only ever sees these, never raw Kick JSON.

export interface Category {
  id: number;
  slug: string;
  name: string;
  /** Slug of the parent group, for example `games`, `irl` or `gambling`. */
  parentSlug: string;
  isMature: boolean;
  tags: string[];
  /** Viewers across the Category now. 0 when Kick does not say. */
  viewerCount: number;
  /** Category art (square webp). Empty when Kick sends none. */
  bannerUrl: string;
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

/** A Channel as Kick search returns it: no Livestream title or viewers, only whether it is live. */
export interface Channel {
  id: number;
  slug: string;
  name: string;
  /** Empty when the Channel has no picture. */
  avatarUrl: string;
  isLive: boolean;
  followerCount: number;
}

/**
 * A Channel as `GET /api/v2/channels/{slug}` gives it: what playback and chat need.
 * (`Channel` is the lighter search result shape.)
 */
export interface ChannelDetail {
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

export interface SearchResults {
  channels: Channel[];
  /** Unfiltered: the Content Filter (ticket 11) reads `isMature`, `parentSlug` and `tags`. */
  categories: Category[];
}

/** Everything the Module reads from Kick. Later tickets add methods here. */
export interface KickApi {
  topLivestreams(): Promise<Livestream[]>;
  /** The Channel with its playback URL, chatroom id and current Livestream (null when offline). */
  channel(slug: string): Promise<ChannelDetail>;
  /** The top Categories for the Home Categories row. */
  topCategories(): Promise<Category[]>;
  /** The Livestreams in one Category (by slug), most viewers first. */
  categoryLivestreams(slug: string): Promise<Livestream[]>;
  /** Channels and Categories that match a searched word. */
  search(word: string): Promise<SearchResults>;
  /** The Livestream a Channel airs now, or null when it is offline. */
  channelLivestream(slug: string): Promise<Livestream | null>;
}
