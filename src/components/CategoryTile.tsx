import type { Category } from '../api/types';

export function CategoryTile({ category, onSelect }: { category: Category; onSelect?: () => void }) {
  return (
    <div class="category-tile" data-focus onClick={onSelect}>
      <div class="category-art">{category.bannerUrl ? <img src={category.bannerUrl} alt="" /> : null}</div>
      <div class="category-name">{category.name}</div>
    </div>
  );
}
