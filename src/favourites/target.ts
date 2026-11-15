// The yellow key adds or removes the Favourite of the focused tile. Each Livestream or Channel tile
// spreads `favouriteTarget()` on its focusable element; the App reads it back from the focused one.
import type { FavouriteChannel } from './favourites';

const SLUG = 'data-favourite-slug';
const NAME = 'data-favourite-name';
const AVATAR = 'data-favourite-avatar';

/** Attributes that make a tile a yellow key target for this Channel. */
export function favouriteTarget(channel: FavouriteChannel): Record<string, string> {
  return { [SLUG]: channel.slug, [NAME]: channel.name, [AVATAR]: channel.avatarUrl };
}

/** The Channel of a tile marked with `favouriteTarget()`, or null for anything else. */
export function readFavouriteTarget(el: Element | null): FavouriteChannel | null {
  const slug = el ? el.getAttribute(SLUG) : null;
  if (!el || !slug) return null;
  return { slug, name: el.getAttribute(NAME) || slug, avatarUrl: el.getAttribute(AVATAR) || '' };
}
