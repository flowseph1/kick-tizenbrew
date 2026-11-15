# 07: Chat Overlay

**What to build:** During playback the Viewer presses the green key, or the `Chat` button in the Info Bar, to show or hide the Chat Overlay. It is a read only, semi transparent panel on the right side, about 25% of the screen width, over a full size video. Messages show user names in their Kick colour and Kick emotes as images, with no badges. It keeps the last 50 messages. It stays open until the Viewer closes it. Back closes the Chat Overlay before it leaves playback.

Chat reading uses the public Kick Pusher websocket with no sign in.

See `.scratch/kick-module/spec.md` (Chat Overlay, Remote navigation).

**Blocked by:** 05

**Status:** ready-for-agent

- [x] Green key and the `Chat` button toggle the Chat Overlay.
- [x] New messages appear live; only the last 50 stay.
- [x] Emotes render as images; names use the Kick colour; no badges.
- [x] Back closes the Chat Overlay first, then leaves playback on the next press.
- [x] The websocket closes when playback ends.
- [x] Vitest covers message parsing (emote tokens, colours).

## Comments

### Implementation (ticket-07 branch)

Seams under test (chosen from the ticket, as this run had no one to confirm with): `parseChatFrame`, `splitContent` and `addMessage` in `src/chat/message.ts` with `test/fixtures/chat-events.json`; `connectChat` in `src/chat/connection.ts` against a fake socket with fake timers; `PlaybackSession.livestreamEnded`; the Chat Overlay flow in the App in happy-dom with a fake socket.

Design: the websocket opens when the Chat Overlay shows and closes when it hides, when the Livestream ends or errors, and when the Playback screen goes away (`useChat` in `src/components/ChatOverlay.tsx`). Reopening starts with an empty list. The connection subscribes to `chatrooms.{chatroomId}.v2` and `channel.{id}`; `StopStreamBroadcast` calls `session.livestreamEnded()`, the same "Livestream ended" path as the player end (so it only works while the overlay is open). It pings every 60 s, answers server pings and reconnects 5 s after a drop. Message text renders as text nodes, never HTML; a colour that is not plain hex falls back to Kick green. `PlaybackDeps` gained `createSocket`; test fakes of `PlaybackDeps` need it. String added: `chat.waiting`.

Verified without a TV:
- Vitest: the seams above. The App tests cover the green key toggle, the Chat button toggle with `aria-pressed`, the overlay staying open when the Info Bar hides, user name colour, emote `<img>` with `alt`, no badges, HTML in messages shown as text, the 50 message limit, Back closing the Info Bar, then the Chat Overlay, then leaving, and the websocket closing on Stop and on the Livestream end.
- Node 22 against live Kick: `connectChat` from this branch, bundled with esbuild, received live messages for chatroom 668 with Kick colours and an emote part (`files.kick.com/emotes/5756680/fullsize`).

Not verified, needs the test TV (UN58RU7100, Tizen 5.0):
- The Pusher key and `wss://` from the TV browser (spec: verify the key on the TV), the green key (code 404) reaching the page, and the overlay look over the AVPlay plane (25% width, semi transparent). The boxes above are ticked from the off TV checks.
