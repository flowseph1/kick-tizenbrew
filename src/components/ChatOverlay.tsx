import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChannelDetail } from '../api/types';
import { useApp } from '../app/context';
import { connectChat, type ChatConnection, type SocketFactory } from '../chat/connection';
import { addMessage, type ChatMessage } from '../chat/message';

export interface ChatState {
  /** True while the Chat Overlay shows. */
  open: boolean;
  /** Like `open`, but current between renders (for the key handler). */
  isOpen(): boolean;
  messages: ChatMessage[];
  /** Shows the Chat Overlay (connects to the chatroom) or hides it (closes the websocket). */
  toggle(): void;
  close(): void;
}

/**
 * The Chat Overlay's state for one Playback screen. The websocket is open only while the overlay
 * shows, and always closes when the screen goes away or `active` turns false (the Livestream ended).
 */
export function useChat(opts: {
  channel: () => ChannelDetail | null;
  createSocket: SocketFactory;
  active: boolean;
  onLivestreamEnded: () => void;
}): ChatState {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const conn = useRef<ChatConnection | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  function close() {
    if (conn.current) conn.current.close();
    conn.current = null;
    setOpen(false);
  }

  function show() {
    const ch = latest.current.channel();
    if (!ch || !ch.livestream || !latest.current.active) return;
    setMessages([]);
    setOpen(true);
    conn.current = connectChat({
      chatroomId: ch.chatroomId,
      channelId: ch.id,
      createSocket: latest.current.createSocket,
      onMessage: (m) => setMessages((list) => addMessage(list, m)),
      onLivestreamEnded: () => latest.current.onLivestreamEnded(),
    });
  }

  useEffect(() => {
    if (!opts.active) close();
  }, [opts.active]);
  useEffect(() => close, []);

  return {
    open,
    isOpen: () => conn.current !== null,
    messages,
    toggle: () => (conn.current ? close() : show()),
    close,
  };
}

/** Read only chat on the right side of the video: user names in their Kick colour, emotes as images, no badges. */
export function ChatOverlay({ messages }: { messages: ChatMessage[] }) {
  const { t } = useApp();
  return (
    <div class="chat-overlay">
      {messages.length === 0 ? <div class="chat-waiting">{t('chat.waiting')}</div> : null}
      {messages.map((m) => (
        <div class="chat-message" key={m.id}>
          <span class="chat-user" style={{ color: m.color }}>
            {m.username}
          </span>
          {': '}
          {m.parts.map((p, i) =>
            'emote' in p ? <img key={i} class="chat-emote" src={p.url} alt={p.emote} /> : <span key={i}>{p.text}</span>,
          )}
        </div>
      ))}
    </div>
  );
}
