import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import events from '../../test/fixtures/chat-events.json';
import { CHAT_URL, PING_MS, RECONNECT_MS, connectChat, type ChatSocket } from './connection';
import type { ChatMessage } from './message';

class FakeSocket implements ChatSocket {
  sent: any[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closed = true;
  }
  receive(frame: unknown) {
    this.onmessage!({ data: JSON.stringify(frame) });
  }
  drop() {
    this.onclose!();
  }
}

let sockets: FakeSocket[];
let messages: ChatMessage[];
let ended: number;

function connect() {
  return connectChat({
    chatroomId: 668,
    channelId: 1,
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    onMessage: (m) => messages.push(m),
    onLivestreamEnded: () => ended++,
  });
}

beforeEach(() => {
  sockets = [];
  messages = [];
  ended = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connectChat', () => {
  it('opens the public Kick Pusher socket and subscribes to the chatroom and the Channel with no auth', () => {
    connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(CHAT_URL);
    expect(CHAT_URL).toContain('wss://ws-us2.pusher.com/app/34bf7a0ff419a2a775b9?protocol=7');

    sockets[0].receive(events[0]);
    expect(sockets[0].sent).toEqual([
      { event: 'pusher:subscribe', data: { auth: '', channel: 'chatrooms.668.v2' } },
      { event: 'pusher:subscribe', data: { auth: '', channel: 'channel.1' } },
    ]);
  });

  it('passes chat messages on as they arrive', () => {
    connect();
    sockets[0].receive(events[0]);
    sockets[0].receive(events[2]);
    sockets[0].receive(events[3]);
    expect(messages.map((m) => m.username)).toEqual(['jese_vp', 'itsnotM00']);
  });

  it('reports the Livestream end', () => {
    connect();
    sockets[0].receive({ event: 'App\\Events\\StopStreamBroadcast', data: '{}', channel: 'channel.1' });
    expect(ended).toBe(1);
  });

  it('answers a server ping and pings the server while connected', () => {
    connect();
    sockets[0].receive(events[0]);
    sockets[0].sent = [];
    sockets[0].receive({ event: 'pusher:ping', data: {} });
    expect(sockets[0].sent).toEqual([{ event: 'pusher:pong', data: {} }]);

    sockets[0].sent = [];
    vi.advanceTimersByTime(PING_MS);
    expect(sockets[0].sent).toEqual([{ event: 'pusher:ping', data: {} }]);
  });

  it('reconnects after the socket drops', () => {
    connect();
    sockets[0].drop();
    vi.advanceTimersByTime(RECONNECT_MS - 1);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('close() closes the socket, stops pings and never reconnects', () => {
    const chat = connect();
    sockets[0].receive(events[0]);
    chat.close();
    expect(sockets[0].closed).toBe(true);

    sockets[0].sent = [];
    sockets[0].drop();
    vi.advanceTimersByTime(RECONNECT_MS + PING_MS);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent).toEqual([]);
    sockets[0].receive(events[2]);
    expect(messages).toEqual([]);
  });

  it('a socket that cannot be made retries later instead of throwing', () => {
    let fail = true;
    connectChat({
      chatroomId: 668,
      channelId: 1,
      createSocket: (url) => {
        if (fail) throw new Error('blocked');
        const s = new FakeSocket(url);
        sockets.push(s);
        return s;
      },
      onMessage: () => {},
      onLivestreamEnded: () => {},
    });
    fail = false;
    vi.advanceTimersByTime(RECONNECT_MS);
    expect(sockets).toHaveLength(1);
  });
});
