# 07: Chat Overlay

**What to build:** During playback the Viewer presses the green key, or the `Chat` button in the Info Bar, to show or hide the Chat Overlay. It is a read only, semi transparent panel on the right side, about 25% of the screen width, over a full size video. Messages show user names in their Kick colour and Kick emotes as images, with no badges. It keeps the last 50 messages. It stays open until the Viewer closes it. Back closes the Chat Overlay before it leaves playback.

Chat reading uses the public Kick Pusher websocket with no sign in.

See `.scratch/kick-module/spec.md` (Chat Overlay, Remote navigation).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Green key and the `Chat` button toggle the Chat Overlay.
- [ ] New messages appear live; only the last 50 stay.
- [ ] Emotes render as images; names use the Kick colour; no badges.
- [ ] Back closes the Chat Overlay first, then leaves playback on the next press.
- [ ] The websocket closes when playback ends.
- [ ] Vitest covers message parsing (emote tokens, colours).
