import { describe, expect, it } from 'vitest';
import topFixture from '../../test/fixtures/stream-livestreams.json';
import { createKickApi, KickApiError } from './kick';

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
