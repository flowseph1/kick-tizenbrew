// Reads Kick's Pusher frames for the Chat Overlay. A frame is `{event, data, channel?}`, where
// `data` is itself a JSON string for Kick events. See the research notes (kick-chat.md).

/** The most messages the Chat Overlay keeps. */
export const MAX_MESSAGES = 50;

/** User name colour when Kick sends none (or one that is not a plain hex colour). */
export const DEFAULT_COLOR = '#53fc18';

export type ChatPart = { text: string } | { emote: string; url: string };

export interface ChatMessage {
  id: string;
  username: string;
  /** The Kick colour of the user name, as `#rgb` or `#rrggbb`. */
  color: string;
  parts: ChatPart[];
}

export type ChatFrame =
  | { type: 'connected' }
  | { type: 'ping' }
  | { type: 'message'; message: ChatMessage }
  | { type: 'livestreamEnded' };

const CHAT_MESSAGE = 'App\\Events\\ChatMessageEvent';
const STOP_STREAM = 'App\\Events\\StopStreamBroadcast';
const EMOTE = /\[emote:(\d+):([^\]]*)\]/g;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function emoteUrl(id: string): string {
  return 'https://files.kick.com/emotes/' + id + '/fullsize';
}

/** Splits message content into text and `[emote:id:name]` parts. */
export function splitContent(content: string): ChatPart[] {
  const parts: ChatPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  EMOTE.lastIndex = 0;
  while ((m = EMOTE.exec(content))) {
    if (m.index > last) parts.push({ text: content.slice(last, m.index) });
    parts.push({ emote: m[2], url: emoteUrl(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last) });
  return parts;
}

function parseJson(text: unknown): any {
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function toMessage(data: any): ChatMessage | null {
  if (!data || typeof data.content !== 'string' || !data.sender) return null;
  const identity = data.sender.identity;
  const color = identity && typeof identity.color === 'string' && HEX_COLOR.test(identity.color) ? identity.color : DEFAULT_COLOR;
  return {
    id: String(data.id),
    username: String(data.sender.username),
    color,
    parts: splitContent(data.content),
  };
}

/** One websocket frame as the Chat Overlay sees it; null for frames it ignores or cannot read. */
export function parseChatFrame(raw: string): ChatFrame | null {
  const frame = parseJson(raw);
  if (!frame || typeof frame.event !== 'string') return null;
  switch (frame.event) {
    case 'pusher:connection_established':
      return { type: 'connected' };
    case 'pusher:ping':
      return { type: 'ping' };
    case STOP_STREAM:
      return { type: 'livestreamEnded' };
    case CHAT_MESSAGE: {
      const message = toMessage(parseJson(frame.data));
      return message ? { type: 'message', message } : null;
    }
    default:
      return null;
  }
}

/** Adds a message at the end, dropping the oldest past MAX_MESSAGES. Returns a new list. */
export function addMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const next = list.concat([message]);
  return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
}
