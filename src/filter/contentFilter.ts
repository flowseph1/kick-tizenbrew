// The Content Filter rules, in one place. When the setting is on, the Module hides
// gambling Categories and Livestreams that Kick marks as mature (and Livestreams in a
// gambling Category). Screens call these; the API adapter stays unfiltered.
// Favourites never go through this filter.
import type { Category, Livestream } from '../api/types';

/** Kick's parent group for gambling Categories. */
const GAMBLING_GROUP = 'gambling';

/** Kick's tag for gambling Categories. Compared without case. */
const GAMBLING_TAG = 'gambling';

/** Gambling Category slugs, for a Category that comes without its group or tag. */
export const GAMBLING_CATEGORY_SLUGS: string[] = ['slots', 'gambling'];

export function isGamblingCategory(category: Category): boolean {
  if (category.parentSlug === GAMBLING_GROUP) return true;
  if (GAMBLING_CATEGORY_SLUGS.indexOf(category.slug) !== -1) return true;
  return category.tags.some((tag) => tag.toLowerCase() === GAMBLING_TAG);
}

export function isHiddenLivestream(livestream: Livestream, filterOn: boolean): boolean {
  if (!filterOn) return false;
  return livestream.isMature || (!!livestream.category && isGamblingCategory(livestream.category));
}

export function visibleCategories(categories: Category[], filterOn: boolean): Category[] {
  return filterOn ? categories.filter((c) => !isGamblingCategory(c)) : categories;
}

export function visibleLivestreams(livestreams: Livestream[], filterOn: boolean): Livestream[] {
  return filterOn ? livestreams.filter((ls) => !isHiddenLivestream(ls, true)) : livestreams;
}
