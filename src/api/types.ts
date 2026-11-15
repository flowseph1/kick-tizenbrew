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

/** Everything the Module reads from Kick. Later tickets add methods here. */
export interface KickApi {
  topLivestreams(): Promise<Livestream[]>;
}
