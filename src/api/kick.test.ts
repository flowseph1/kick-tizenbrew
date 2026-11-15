import { describe, expect, it } from 'vitest';
import topFixture from '../../test/fixtures/stream-livestreams.json';
import liveChannel from '../../test/fixtures/channel-live.json';
import offlineChannel from '../../test/fixtures/channel-offline.json';
import missingChannel from '../../test/fixtures/channel-404.json';
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

describe('channel', () => {
  it('maps a live Channel with its playback URL, chatroom id and Livestream', async () => {
    const calls: string[] = [];
    const channel = await createKickApi(fakeFetch(200, liveChannel, calls)).channel('xqc');

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
    const channel = await createKickApi(fakeFetch(200, offlineChannel)).channel('degengambaslots');
    expect(channel.slug).toBe('degengambaslots');
    expect(channel.livestream).toBeNull();
  });

  it('encodes the slug in the URL', async () => {
    const calls: string[] = [];
    await createKickApi(fakeFetch(200, liveChannel, calls)).channel('a b');
    expect(calls).toEqual(['https://kick.com/api/v2/channels/a%20b']);
  });

  it('rejects with a 404 KickApiError for an unknown Channel', async () => {
    const p = createKickApi(fakeFetch(404, missingChannel)).channel('nobody');
    await expect(p).rejects.toBeInstanceOf(KickApiError);
    await expect(p).rejects.toMatchObject({ status: 404 });
  });
});
