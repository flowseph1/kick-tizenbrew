import { describe, expect, it } from 'vitest';
import topFixture from '../../test/fixtures/stream-livestreams.json';
import categoriesTopFixture from '../../test/fixtures/categories-top.json';
import subcategoriesFixture from '../../test/fixtures/subcategories.json';
import categoryStreamsFixture from '../../test/fixtures/stream-livestreams-category.json';
import { createKickApi, KickApiError, mapCategory } from './kick';

function fakeFetch(status: number, body: unknown, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
}

describe('topLivestreams', () => {
  it('maps the recorded Kick response into Livestreams', async () => {
    const api = createKickApi(fakeFetch(200, topFixture));
    const list = await api.topLivestreams();

    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      id: 137906841,
      channelSlug: 'greyble',
      channelName: 'Greyble',
      channelAvatarUrl:
        'https://files.kick.com/images/user/5338549/profile_image/conversion/d79a8cfb-fa27-4615-97d6-1597535b2a4b-thumb.webp',
      title: 'WOW FOREVER NEW PLAYER! | with Greyble and Plubell | !donate\\!tts',
      viewerCount: 0,
      isMature: false,
      thumbnailUrl:
        'https://images.kick.com/video_thumbnails/urDGN08wH7xv/bH17JkJMU4G1/720.webp?versionId=.HBPV0fekvljLVUXFP3FM_OorC9em39O',
      category: {
        id: 14374,
        slug: 'world-of-warcraft-forever',
        name: 'World of Warcraft: Forever',
        parentSlug: 'games',
        isMature: false,
        tags: ['Action', 'Open World', 'Warfare', 'Fantasy'],
        viewerCount: 14726,
        bannerUrl: '',
      },
    });
    expect(list[1].channelSlug).toBe('toxic-claw');
    expect(list[1].isMature).toBe(true);
  });

  it('asks Kick for the most watched Livestreams first', async () => {
    const calls: string[] = [];
    await createKickApi(fakeFetch(200, topFixture, calls)).topLivestreams();
    expect(calls).toEqual(['https://kick.com/stream/livestreams/en?limit=24&sort=desc&page=1']);
  });

  it('tolerates a Livestream with no Category and no thumbnail', async () => {
    const api = createKickApi(
      fakeFetch(200, {
        data: [{ id: 1, session_title: 't', viewer_count: 5, channel: { slug: 'a', user: { username: 'A' } } }],
      }),
    );
    const [item] = await api.topLivestreams();
    expect(item.category).toBeNull();
    expect(item.thumbnailUrl).toBe('');
    expect(item.channelAvatarUrl).toBe('');
    expect(item.isMature).toBe(false);
  });

  it('rejects with a KickApiError when Kick answers with an error status', async () => {
    const api = createKickApi(fakeFetch(403, { message: 'blocked' }));
    await expect(api.topLivestreams()).rejects.toBeInstanceOf(KickApiError);
  });

  it('rejects with a KickApiError when the network fails', async () => {
    const api = createKickApi(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api.topLivestreams()).rejects.toBeInstanceOf(KickApiError);
  });

  it('rejects with a KickApiError when the body is not the expected shape', async () => {
    const api = createKickApi(fakeFetch(200, { nope: true }));
    await expect(api.topLivestreams()).rejects.toBeInstanceOf(KickApiError);
  });
});

describe('topCategories', () => {
  it('maps the recorded Kick response into Categories, keeping slug, parent and mature flag', async () => {
    const calls: string[] = [];
    const list = await createKickApi(fakeFetch(200, categoriesTopFixture, calls)).topCategories();

    expect(calls).toEqual(['https://kick.com/api/v1/categories/top']);
    expect(list.map((c) => c.slug)).toEqual(['special-events', 'just-chatting', 'slots']);
    expect(list[1]).toEqual({
      id: 15,
      slug: 'just-chatting',
      name: 'Just Chatting',
      parentSlug: 'irl',
      isMature: false,
      tags: ['IRL', 'Casual'],
      viewerCount: 257963,
      bannerUrl:
        'https://files.kick.com/images/subcategories/15/banner/conversion/5546d68b-e9f9-49f9-a658-9d2ece637064-banner.webp',
    });
    expect(list[2]).toMatchObject({ name: 'Slots & Casino', parentSlug: 'gambling', isMature: true, tags: ['Gambling'] });
  });

  it('reads the banner from the subcategories shape too (banner.url)', () => {
    const c = mapCategory(subcategoriesFixture.data[0]);
    expect(c!.bannerUrl).toMatch(/^https:\/\/files\.kick\.com\/images\/subcategories\/261\/banner\/.+\.webp$/);
  });

  it('rejects with a KickApiError when the body is not a list', async () => {
    await expect(createKickApi(fakeFetch(200, { data: [] })).topCategories()).rejects.toBeInstanceOf(KickApiError);
  });
});

describe('categoryLivestreams', () => {
  it('asks Kick for the Livestreams of one Category, most watched first', async () => {
    const calls: string[] = [];
    const list = await createKickApi(fakeFetch(200, categoryStreamsFixture, calls)).categoryLivestreams('just-chatting');

    expect(calls).toEqual([
      'https://kick.com/stream/livestreams/en?limit=32&sort=desc&page=1&subcategory=just-chatting',
    ]);
    expect(list.map((l) => l.channelSlug)).toEqual(['brabox', 'davooxeneize', '3mr', 'gabepeixe', 'niter']);
    expect(list[0]).toMatchObject({ channelName: 'Brabox', viewerCount: 37167, isMature: false });
    expect(list[0].category!.slug).toBe('just-chatting');
    expect(list[4].isMature).toBe(true);
  });

  it('encodes the Category slug', async () => {
    const calls: string[] = [];
    await createKickApi(fakeFetch(200, { data: [] }, calls)).categoryLivestreams('a&b c');
    expect(calls[0]).toContain('&subcategory=a%26b%20c');
  });

  it('rejects with a KickApiError when Kick answers with an error status', async () => {
    await expect(createKickApi(fakeFetch(500, {})).categoryLivestreams('x')).rejects.toBeInstanceOf(KickApiError);
  });
});
