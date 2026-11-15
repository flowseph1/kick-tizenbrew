import type { ComponentChildren } from 'preact';

/** A titled horizontal row of tiles. Home stacks several (Favourites, Top Livestreams, Categories). */
export function Row({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="row">
      <h2 class="row-title">{title}</h2>
      <div class="row-items">{children}</div>
    </section>
  );
}
