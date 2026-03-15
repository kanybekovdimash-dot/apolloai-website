import { Room, RoomEvent, Track } from "livekit-client";

const AVATAR_SESSION_ENDPOINT = "/avatar-session";

let currentRoom = null;

export async function connectAvatar({ apiBase, sessionId, videoEl, audioEl, onStateChange }) {
  if (currentRoom) {
    await disconnectAvatar();
  }

  onStateChange?.("connecting");

  const res = await fetch(`${apiBase}${AVATAR_SESSION_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "Failed to create avatar session");
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true
  });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (participant.identity.startsWith("bot-")) {
      if (track.kind === Track.Kind.Video && videoEl) {
        track.attach(videoEl);
      }
      if (track.kind === Track.Kind.Audio && audioEl) {
        track.attach(audioEl);
      }
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach();
  });

  room.on(RoomEvent.Disconnected, () => {
    onStateChange?.("disconnected");
  });

  room.on(RoomEvent.Connected, () => {
    onStateChange?.("connected");
  });

  room.on(RoomEvent.DataReceived, (payload, participant) => {
    if (participant?.identity.startsWith("bot-")) {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "avatar-state") {
          onStateChange?.(msg.state);
        }
      } catch { /* ignore non-JSON data */ }
    }
  });

  await room.connect(data.livekitUrl, data.token);

  // Publish microphone track so the bot can hear us
  await room.localParticipant.setMicrophoneEnabled(true);

  currentRoom = room;

  return {
    room,
    roomName: data.roomName,
    sessionId: data.sessionId
  };
}

export async function disconnectAvatar() {
  if (currentRoom) {
    await currentRoom.disconnect();
    currentRoom = null;
  }
}

export function isConnected() {
  return currentRoom?.state === "connected";
}
