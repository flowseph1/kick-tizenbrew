# kick-tizenbrew

A TizenBrew module that lets a viewer watch Kick on a Samsung Tizen TV with the remote.

## Language

**Module**:
The installable TizenBrew package that this repo publishes.
_Avoid_: App, plugin, extension

**Viewer**:
The person who uses the Module on the TV. Viewers are anonymous in v1.
_Avoid_: User, account

**Channel**:
A Kick streamer's page, identified by its slug (for example `xqc`).
_Avoid_: Streamer, creator, user

**Livestream**:
The broadcast a Channel is airing right now. A Channel has zero or one Livestream at a time.
_Avoid_: Stream, broadcast, live

**Category**:
A Kick grouping of Livestreams by topic or game (for example "Just Chatting").
_Avoid_: Game, genre, tag

**Content Filter**:
The Viewer setting that hides gambling Categories and Livestreams marked mature. It is off by default.
_Avoid_: Parental control, safe mode

**Favourite**:
A Channel the Viewer pinned on this TV. Favourites stay on the TV and replace a Kick "Following" list.
_Avoid_: Follow, subscription, bookmark

**Watch Count**:
How many times a Livestream of a Favourite started to play on this TV. Only Favourites have one.
_Avoid_: Views, plays, popularity

**Info Bar**:
The temporary strip over the video that shows the Livestream's Channel, title, Category and viewer count.
_Avoid_: OSD, banner, HUD

**Quality**:
The video resolution and frame rate the Viewer picks for a Livestream, or Auto to let the player adapt.
_Avoid_: Resolution, bitrate, rendition

**Chat Overlay**:
The read only view of a Livestream's chat, shown over the video and toggled with a remote key.
_Avoid_: Chat panel, chat window
