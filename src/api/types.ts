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

/** Everything the Module reads from Kick. Later tickets add methods here. */
export interface KickApi {
  topLivestreams(): Promise<Livestream[]>;
  /** The top Categories for the Home Categories row. */
  topCategories(): Promise<Category[]>;
  /** The Livestreams in one Category (by slug), most viewers first. */
  categoryLivestreams(slug: string): Promise<Livestream[]>;
}
