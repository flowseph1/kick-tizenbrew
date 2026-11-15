// The read only Kick chat connection: the public Pusher websocket, no sign in.
// Subscribes to `chatrooms.{chatroomId}.v2` (messages) and `channel.{channelId}` (Livestream end).
// Verify the app key on the TV (spec, Chat Overlay).
import { parseChatFrame, type ChatMessage } from './message';

export const CHAT_URL = 'wss://ws-us2.pusher.com/app/34bf7a0ff419a2a775b9?protocol=7&client=js&version=8.4.0&flash=false';

/** Pusher's activity timeout is 120 s; ping well inside it. */
export const PING_MS = 60000;
/** Wait this long before reconnecting after the socket drops. */
export const RECONNECT_MS = 5000;

/** The part of a browser WebSocket the chat uses. */
export interface ChatSocket {
  send(text: string): void;
  close(): void;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
}

export type SocketFactory = (url: string) => ChatSocket;

export interface ChatOptions {
  chatroomId: number;
  channelId: number;
  createSocket: SocketFactory;
  onMessage: (message: ChatMessage) => void;
  onLivestreamEnded: () => void;
}

export interface ChatConnection {
  /** Closes the socket for good: no more messages, pings or reconnects. */
  close(): void;
}

export function connectChat(opts: ChatOptions): ChatConnection {
  let socket: ChatSocket | null = null;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function send(s: ChatSocket, event: string, data: unknown) {
    try {
      s.send(JSON.stringify({ event, data }));
    } catch (e) {
      // The socket is closing; onclose reconnects.
    }
  }

  function subscribe(s: ChatSocket, channel: string) {
    send(s, 'pusher:subscribe', { auth: '', channel });
  }

  function scheduleReconnect() {
    clearInterval(pingTimer);
    pingTimer = undefined;
    if (closed || reconnectTimer !== undefined) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      open();
    }, RECONNECT_MS);
  }

  function open() {
    let s: ChatSocket;
    try {
      s = opts.createSocket(CHAT_URL);
    } catch (e) {
      scheduleReconnect();
      return;
    }
    socket = s;
    s.onmessage = (e) => {
      if (closed || socket !== s) return;
      const frame = parseChatFrame(e.data);
      if (!frame) return;
      if (frame.type === 'connected') {
        subscribe(s, 'chatrooms.' + opts.chatroomId + '.v2');
        subscribe(s, 'channel.' + opts.channelId);
        clearInterval(pingTimer);
        pingTimer = setInterval(() => send(s, 'pusher:ping', {}), PING_MS);
      } else if (frame.type === 'ping') {
        send(s, 'pusher:pong', {});
      } else if (frame.type === 'message') {
        opts.onMessage(frame.message);
      } else {
        opts.onLivestreamEnded();
      }
    };
    s.onclose = () => {
      if (socket === s) scheduleReconnect();
    };
  }

  open();

  return {
    close() {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      pingTimer = reconnectTimer = undefined;
      const s = socket;
      socket = null;
      if (s) {
        try {
          s.close();
        } catch (e) {
          // Already closed.
        }
      }
    },
  };
}
