import { describe, expect, it } from 'vitest';
import topFixture from '../../test/fixtures/stream-livestreams.json';
import categoriesTopFixture from '../../test/fixtures/categories-top.json';
import subcategoriesFixture from '../../test/fixtures/subcategories.json';
import categoryStreamsFixture from '../../test/fixtures/stream-livestreams-category.json';
import searchXqcFixture from '../../test/fixtures/search-xqc.json';
import searchSlotsFixture from '../../test/fixtures/search-slots.json';
import channelLiveFixture from '../../test/fixtures/channel-live.json';
import channelOfflineFixture from '../../test/fixtures/channel-offline.json';
import channel404Fixture from '../../test/fixtures/channel-404.json';
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

describe('channel', () => {
  it('maps a live Channel with its playback URL, chatroom id and Livestream', async () => {
    const calls: string[] = [];
    const channel = await createKickApi(fakeFetch(200, channelLiveFixture, calls)).channel('xqc');

    expect(calls).toEqual(['https://kick.com/api/v2/channels/xqc']);
    expect(channel.id).toBe(668);
    expect(channel.slug).toBe('xqc');
    expect(channel.name).toBe('xQc');
    expect(channel.avatarUrl).toBe(
      'https://files.kick.com/images/user/676/profile_image/conversion/931b4e8f-5445-427c-bd82-b473530390cc-fullsize.webp',
    );
    expect(channel.chatroomId).toBe(668);
    expect(channel.playbackUrl).toBe(
      'https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.DsuAwCgUc9Bh.m3u8?token=REDACTED',
    );
    expect(channel.livestream).not.toBeNull();
    const ls = channel.livestream!;
    expect(ls.id).toBe(137883983);
    expect(ls.channelSlug).toBe('xqc');
    expect(ls.channelName).toBe('xQc');
    expect(ls.viewerCount).toBe(9852);
    expect(ls.isMature).toBe(true);
    expect(ls.thumbnailUrl).toBe('https://stream.kick.com/thumbnails/livestream/137883983/thumb0/video_thumbnail/thumb0.jpg');
    expect(ls.category!.name).toBe('The Legend of Zelda: Ocarina of Time');
    expect(ls.category!.parentSlug).toBe('games');
  });

  it('maps an offline Channel with no Livestream', async () => {
    const channel = await createKickApi(fakeFetch(200, channelOfflineFixture)).channel('degengambaslots');
    expect(channel.slug).toBe('degengambaslots');
    expect(channel.livestream).toBeNull();
  });

  it('encodes the slug in the URL', async () => {
    const calls: string[] = [];
    await createKickApi(fakeFetch(200, channelLiveFixture, calls)).channel('a b');
    expect(calls).toEqual(['https://kick.com/api/v2/channels/a%20b']);
  });

  it('rejects with a 404 KickApiError for an unknown Channel', async () => {
    const p = createKickApi(fakeFetch(404, channel404Fixture)).channel('nobody');
    await expect(p).rejects.toBeInstanceOf(KickApiError);
    await expect(p).rejects.toMatchObject({ status: 404 });
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

describe('search', () => {
  it('maps the recorded Kick search into Channels and Categories', async () => {
    const results = await createKickApi(fakeFetch(200, searchXqcFixture)).search('xqc');

    expect(results.channels).toHaveLength(3);
    expect(results.channels[0]).toEqual({
      id: 668,
      slug: 'xqc',
      name: 'xQc',
      avatarUrl:
        'https://files.kick.com/images/user/676/profile_image/conversion/931b4e8f-5445-427c-bd82-b473530390cc-fullsize.webp',
      isLive: true,
      followerCount: 1633107,
    });
    expect(results.channels[1]).toMatchObject({ slug: 'xqcisoffline', isLive: false, avatarUrl: '' });
    expect(results.categories).toEqual([]);
  });

  it('keeps the Category data the Content Filter needs', async () => {
    const results = await createKickApi(fakeFetch(200, searchSlotsFixture)).search('slots');

    expect(results.categories[0]).toMatchObject({
      id: 28,
      slug: 'slots',
      name: 'Slots & Casino',
      parentSlug: 'gambling',
      isMature: true,
      tags: ['Gambling'],
      bannerUrl:
        'https://files.kick.com/images/subcategories/28/banner/conversion/f9233069-cfa7-4ae1-9b33-f2b9ca652fef-banner.webp',
    });
  });

  it('encodes the searched word', async () => {
    const calls: string[] = [];
    await createKickApi(fakeFetch(200, searchXqcFixture, calls)).search('just chatting & co');
    expect(calls).toEqual(['https://kick.com/api/search?searched_word=just%20chatting%20%26%20co']);
  });

  it('treats missing lists as empty', async () => {
    const results = await createKickApi(fakeFetch(200, { livestreams: { tags: [] } })).search('zzz');
    expect(results).toEqual({ channels: [], categories: [] });
  });

  it('rejects with a KickApiError when Kick fails', async () => {
    await expect(createKickApi(fakeFetch(429, {})).search('x')).rejects.toBeInstanceOf(KickApiError);
  });
});

describe('channelLivestream', () => {
  it('maps the Livestream of a live Channel', async () => {
    const calls: string[] = [];
    const ls = await createKickApi(fakeFetch(200, channelLiveFixture, calls)).channelLivestream('xqc');

    expect(calls).toEqual(['https://kick.com/api/v2/channels/xqc']);
    expect(ls).toMatchObject({
      id: 137883983,
      channelSlug: 'xqc',
      channelName: 'xQc',
      viewerCount: 9852,
      isMature: true,
      thumbnailUrl: 'https://stream.kick.com/thumbnails/livestream/137883983/thumb0/video_thumbnail/thumb0.jpg',
    });
    expect(ls!.title).toContain('LIVE');
    expect(ls!.category).toMatchObject({ slug: 'the-legend-of-zelda-ocarina-of-time-1', parentSlug: 'games' });
  });

  it('returns null for an offline Channel', async () => {
    const ls = await createKickApi(fakeFetch(200, channelOfflineFixture)).channelLivestream('degengambaslots');
    expect(ls).toBeNull();
  });

  it('rejects with a KickApiError for an unknown Channel', async () => {
    await expect(createKickApi(fakeFetch(404, channel404Fixture)).channelLivestream('nobody')).rejects.toBeInstanceOf(
      KickApiError,
    );
  });
});
