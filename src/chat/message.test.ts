import { describe, expect, it } from 'vitest';
import events from '../../test/fixtures/chat-events.json';
import { addMessage, DEFAULT_COLOR, parseChatFrame, splitContent, type ChatMessage } from './message';

describe('parseChatFrame', () => {
  it('reads a Kick chat message: id, user name, Kick colour and content', () => {
    expect(parseChatFrame(JSON.stringify(events[4]))).toEqual({
      type: 'message',
      message: {
        id: '777d807c-021e-480b-980f-0d3a5fbbe155',
        username: 'mordhau_af',
        color: '#55FFC7',
        parts: [{ text: 'Fishge' }],
      },
    });
  });

  it('turns emote tokens into emote parts with the Kick image URL', () => {
    const frame = parseChatFrame(JSON.stringify(events[3]));
    expect(frame).toEqual({
      type: 'message',
      message: {
        id: '11afbe11-0686-46c9-8425-e94e52cd249e',
        username: 'itsnotM00',
        color: '#FFD899',
        parts: [{ emote: 'emojiCrave', url: 'https://files.kick.com/emotes/1730760/fullsize' }],
      },
    });
  });

  it('reads a reply like any message, without badges', () => {
    const frame = parseChatFrame(JSON.stringify(events[2]));
    expect(frame).toEqual({
      type: 'message',
      message: { id: '76b2483f-38f2-49ec-a80d-ee91c22ab719', username: 'jese_vp', color: '#FF2C56', parts: [{ text: "Majora's mask Cinema" }] },
    });
  });

  it('uses the default colour when the sender has none or an unsafe one', () => {
    const data = (color: unknown) =>
      JSON.stringify({
        event: 'App\\Events\\ChatMessageEvent',
        data: JSON.stringify({ id: 'a', content: 'hi', sender: { username: 'u', identity: { color } } }),
      });
    const color = (c: unknown) => {
      const f = parseChatFrame(data(c));
      return f && f.type === 'message' ? f.message.color : null;
    };
    expect(color(undefined)).toBe(DEFAULT_COLOR);
    expect(color('red; background: url(x)')).toBe(DEFAULT_COLOR);
    expect(color('#abc')).toBe('#abc');
  });

  it('reads the Pusher handshake, pings and the Livestream end; ignores the rest', () => {
    expect(parseChatFrame(JSON.stringify(events[0]))).toEqual({ type: 'connected' });
    expect(parseChatFrame('{"event":"pusher:ping","data":{}}')).toEqual({ type: 'ping' });
    expect(parseChatFrame('{"event":"App\\\\Events\\\\StopStreamBroadcast","data":"{}","channel":"channel.668"}')).toEqual({
      type: 'livestreamEnded',
    });
    expect(parseChatFrame(JSON.stringify(events[1]))).toBeNull();
    expect(parseChatFrame('not json')).toBeNull();
    expect(parseChatFrame('{"event":"App\\\\Events\\\\ChatMessageEvent","data":"{bad"}')).toBeNull();
  });
});

describe('splitContent', () => {
  it('keeps text around emotes, in order', () => {
    expect(splitContent('hi [emote:5756671:GIGACHAD] and [emote:1:a b]!')).toEqual([
      { text: 'hi ' },
      { emote: 'GIGACHAD', url: 'https://files.kick.com/emotes/5756671/fullsize' },
      { text: ' and ' },
      { emote: 'a b', url: 'https://files.kick.com/emotes/1/fullsize' },
      { text: '!' },
    ]);
  });

  it('leaves a broken token as text', () => {
    expect(splitContent('[emote:x:y] [emote:12')).toEqual([{ text: '[emote:x:y] [emote:12' }]);
  });
});

describe('addMessage', () => {
  const msg = (n: number): ChatMessage => ({ id: String(n), username: 'u', color: DEFAULT_COLOR, parts: [{ text: 'm' + n }] });

  it('keeps only the last 50 messages, newest last', () => {
    let list: ChatMessage[] = [];
    for (let i = 1; i <= 60; i++) list = addMessage(list, msg(i));
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe('11');
    expect(list[49].id).toBe('60');
  });
});
