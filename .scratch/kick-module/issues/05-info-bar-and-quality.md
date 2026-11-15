# 05: Info Bar and Quality

**What to build:** During playback the Viewer presses OK. The Info Bar shows for 5 s with the Channel name, title, Category and viewer count. Below it are three buttons: `Favourite`, `Chat`, `Quality`. Focus moves to the buttons, and the Info Bar hides after 5 s with no key press. `Quality` opens a list with Auto and the variants from the master playlist (for example 1080p60, 720p60). The chosen Quality applies to the current Livestream. Every new Livestream starts at Auto.

`Favourite` and `Chat` show but do nothing until tickets 06 and 07.

See `.scratch/kick-module/spec.md` (Playback, Playback screen).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] OK during playback shows the Info Bar with correct data; it hides after 5 s with no key press.
- [ ] The three buttons take focus with arrows.
- [ ] `Quality` lists Auto plus the playlist variants; choosing one changes the video on the TV.
- [ ] A new Livestream starts at Auto.
- [ ] Vitest covers building the Quality list from a master playlist.
- [ ] The spec records whether AVPlay switches Quality in place or reopens the stream.
