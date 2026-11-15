import { describe, expect, it } from 'vitest';
import categoriesTopFixture from '../../test/fixtures/categories-top.json';
import searchSlotsFixture from '../../test/fixtures/search-slots.json';
import { createKickApi } from '../api/kick';
import type { Category, Livestream } from '../api/types';
import { isGamblingCategory, isHiddenLivestream, visibleCategories, visibleLivestreams } from './contentFilter';

function category(slug: string, extra: Partial<Category> = {}): Category {
  return { id: 1, slug, name: slug, parentSlug: 'games', isMature: false, tags: [], viewerCount: 0, bannerUrl: '', ...extra };
}

function stream(id: number, extra: Partial<Livestream> = {}): Livestream {
  return {
    id,
    channelSlug: 'c' + id,
    channelName: 'C' + id,
    channelAvatarUrl: '',
    title: '',
    viewerCount: 0,
    isMature: false,
    thumbnailUrl: '',
    category: null,
    ...extra,
  };
}

function apiReturning(body: unknown) {
  return createKickApi(async () => ({ ok: true, status: 200, json: async () => body }));
}

describe('gambling Categories', () => {
  it('counts a Category under the gambling group', () => {
    expect(isGamblingCategory(category('poker-room', { parentSlug: 'gambling' }))).toBe(true);
  });

  it('counts a Category tagged Gambling, in any case', () => {
    expect(isGamblingCategory(category('x', { tags: ['Casino', 'gambling'] }))).toBe(true);
  });

  it('counts Slots & Casino by slug even without its group or tag', () => {
    expect(isGamblingCategory(category('slots'))).toBe(true);
  });

  it('does not count a mature Category that is not gambling', () => {
    expect(isGamblingCategory(category('just-chatting', { parentSlug: 'irl', isMature: true }))).toBe(false);
  });

  it('finds only Slots & Casino in the recorded top Categories', async () => {
    const cats = await apiReturning(categoriesTopFixture).topCategories();
    expect(cats.filter(isGamblingCategory).map((c) => c.slug)).toEqual(['slots']);
  });

  it('finds Slots & Casino in the recorded search for "slots"', async () => {
    const results = await apiReturning(searchSlotsFixture).search('slots');
    expect(results.categories.filter(isGamblingCategory).map((c) => c.slug)).toContain('slots');
  });
});

describe('the filter', () => {
  const cats = [category('fortnite'), category('slots', { parentSlug: 'gambling' }), category('irl', { parentSlug: 'irl' })];
  const streams = [
    stream(1),
    stream(2, { isMature: true }),
    stream(3, { category: category('slots', { parentSlug: 'gambling' }) }),
    stream(4, { category: category('fortnite') }),
  ];

  it('keeps everything when off', () => {
    expect(visibleCategories(cats, false)).toEqual(cats);
    expect(visibleLivestreams(streams, false)).toEqual(streams);
  });

  it('hides gambling Categories when on', () => {
    expect(visibleCategories(cats, true).map((c) => c.slug)).toEqual(['fortnite', 'irl']);
  });

  it('hides mature Livestreams and Livestreams in a gambling Category when on', () => {
    expect(visibleLivestreams(streams, true).map((s) => s.id)).toEqual([1, 4]);
  });

  it('tells whether one Livestream is hidden', () => {
    expect(isHiddenLivestream(stream(2, { isMature: true }), true)).toBe(true);
    expect(isHiddenLivestream(stream(2, { isMature: true }), false)).toBe(false);
    expect(isHiddenLivestream(stream(1), true)).toBe(false);
  });
});
