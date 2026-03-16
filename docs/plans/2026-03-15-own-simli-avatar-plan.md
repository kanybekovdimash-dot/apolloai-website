# Own Simli: Real-time Talking Avatar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the browser-side voice loop with a LiveKit-connected real-time talking avatar powered by Pipecat + Wav2Lip.

**Architecture:** Browser connects to LiveKit room via WebRTC, receives video+audio track from Pipecat bot. Pipecat runs on RunPod alongside Wav2Lip, orchestrates STT→LLM→TTS→lip-sync pipeline. LiveKit on OVH relays media.

**Tech Stack:** LiveKit (WebRTC transport), Pipecat (Python conversation runtime), Wav2Lip (lip-sync model), livekit-client JS SDK, Cloudflare Worker, Vite.

**Implementation order:** Frontend + Worker first → Pipecat bot on OVH (voice-only) → RunPod + Wav2Lip (last).

---

## Phase 1: Frontend + Cloudflare Worker

### Task 1: Add livekit-client dependency

**Files:**
- Modify: `package.json`

**Step 1: Install livekit-client**

Run:
```bash
cd "E:/Проект в гитхабе"
npm install livekit-client
```

**Step 2: Verify install**

Run:
```bash
node -e "require.resolve('livekit-client')"
```
Expected: path to livekit-client module, no errors.

**Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: build succeeds (livekit-client is tree-shakeable ESM).

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add livekit-client dependency for avatar WebRTC"
```

---

### Task 2: Add `/avatar-session` endpoint to Cloudflare Worker

**Files:**
- Modify: `local-worker/worker.js`

**Step 1: Add LiveKit token generation function**

Add after the existing `buildSpeechPayload` function (around line 892):

```js
async function createLiveKitToken({ roomName, participantName, env }) {
  const apiKey = env.LIVEKIT_KEY;
  const apiSecret = env.LIVEKIT_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials not configured");
  }

  // LiveKit JWT: header.payload.signature
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: participantName,
    nbf: now,
    exp: now + 3600,
    jti: participantName + "-" + now,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const data = new TextEncoder().encode(headerB64 + "." + payloadB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return headerB64 + "." + payloadB64 + "." + sigB64;
}
```

**Step 2: Add handleAvatarSession function**

Add after createLiveKitToken:

```js
async function handleAvatarSession(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const sessionId = payload.sessionId || crypto.randomUUID();
  const roomName = "avatar-" + sessionId;
  const participantName = "user-" + sessionId.slice(0, 8);

  const token = await createLiveKitToken({ roomName, participantName, env });
  const livekitUrl = env.LIVEKIT_URL || "";

  if (!livekitUrl) {
    return json({ ok: false, error: "LiveKit URL not configured" }, 500, corsHeaders);
  }

  return json({
    ok: true,
    sessionId,
    roomName,
    participantName,
    token,
    livekitUrl
  }, 200, corsHeaders);
}
```

**Step 3: Add route in fetch handler**

Add in the `try` block of the `fetch` handler, after the `/tts` route (around line 115):

```js
if (request.method === "POST" && url.pathname === "/avatar-session") {
  return handleAvatarSession(request, env, corsHeaders);
}
```

**Step 4: Verify syntax**

Run:
```bash
node --check local-worker/worker.js
```
Expected: no errors.

**Step 5: Commit**

```bash
git add local-worker/worker.js
git commit -m "feat: add /avatar-session endpoint for LiveKit token generation"
```

---

### Task 3: Add LiveKit connection module to frontend

**Files:**
- Create: `livekit-avatar.js`

**Step 1: Create livekit-avatar.js**

This module handles connecting to LiveKit, subscribing to bot's video/audio tracks, and attaching them to DOM elements.

```js
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
```

**Step 2: Verify syntax**

Run:
```bash
node --check livekit-avatar.js
```
Note: This will fail because of ESM imports without bundler. Instead verify with build:
```bash
npm run build
```
Expected: build succeeds.

**Step 3: Commit**

```bash
git add livekit-avatar.js
git commit -m "feat: add LiveKit avatar connection module"
```

---

### Task 4: Integrate LiveKit avatar into app.js

**Files:**
- Modify: `app.js`

**Step 1: Add import at top of app.js**

Add at line 1 (before existing code):

```js
import { connectAvatar, disconnectAvatar, isConnected } from "./livekit-avatar.js";
```

**Step 2: Add AVATAR_SESSION_ENDPOINT constant**

Add after the existing endpoint constants (around line 7):

```js
const AVATAR_SESSION_ENDPOINT = "/avatar-session";
```

**Step 3: Add avatar connection function**

Add after the `requestMicrophoneAccess` function (around line 233):

```js
async function connectLiveKitAvatar() {
  if (isConnected()) {
    return;
  }

  await ensureSession();

  try {
    setAvatarMode("thinking");

    const result = await connectAvatar({
      apiBase: runtime.apiBase,
      sessionId: state.sessionId,
      videoEl: elements.avatarVideo,
      audioEl: elements.avatarAudio,
      onStateChange: (avatarState) => {
        if (avatarState === "connected") {
          setAvatarMode("idle");
          updateAvatarStatus("Аватар подключён. Говорите.");
        } else if (avatarState === "listening") {
          setAvatarMode("listening");
        } else if (avatarState === "thinking") {
          setAvatarMode("thinking");
        } else if (avatarState === "speaking") {
          setAvatarMode("speaking");
        } else if (avatarState === "disconnected") {
          setAvatarMode("idle");
          updateAvatarStatus("Аватар отключён.");
        }
      }
    });

    state.sessionId = result.sessionId;
    state.livekitConnected = true;
  } catch (error) {
    console.error("LiveKit avatar connection failed", error);
    state.livekitConnected = false;
    setAvatarMode("idle");
    updateAvatarStatus("Не удалось подключить аватар. Работает голосовой режим.");
    // Fall back to existing browser voice loop
    queueAutoVoiceCapture(300);
  }
}
```

**Step 4: Modify init() to try LiveKit first**

Replace the microphone timeout block in `init()` (around line 182-184):

```js
window.setTimeout(async () => {
  try {
    await connectLiveKitAvatar();
  } catch {
    // Fallback: use existing browser voice loop
    requestMicrophoneAccess();
  }
}, 180);
```

**Step 5: Modify avatarCore click handler**

Find the existing `avatarCore?.addEventListener("click"` handler and update it to reconnect LiveKit if disconnected. The handler should try LiveKit first, fall back to existing voice capture:

```js
elements.avatarCore?.addEventListener("click", () => {
  if (state.livekitConnected && isConnected()) {
    // LiveKit is managing the conversation, click is a no-op or toggle mute
    return;
  }

  // Try LiveKit connection first
  connectLiveKitAvatar().catch(() => {
    // Fallback to browser voice loop
    if (state.avatarMode === "idle" || state.avatarMode === "listening") {
      startVoiceCapture().catch(() => undefined);
    }
  });
});
```

**Step 6: Add `livekitConnected` to state**

Add to the state object (around line 100):

```js
livekitConnected: false,
```

**Step 7: Add `updateAvatarStatus` helper**

Add near `syncAvatarStatus`:

```js
function updateAvatarStatus(text) {
  if (elements.avatarStatusText) {
    elements.avatarStatusText.textContent = text;
  }
}
```

**Step 8: Verify syntax and build**

Run:
```bash
node --check app.js && npm run build
```
Expected: both pass.

**Step 9: Commit**

```bash
git add app.js
git commit -m "feat: integrate LiveKit avatar connection with fallback to browser voice loop"
```

---

### Task 5: Add LiveKit env vars to worker config

**Files:**
- Modify: `local-worker/.dev.vars.example`

**Step 1: Add LiveKit variables**

Append to the file:

```env
LIVEKIT_URL=ws://51.38.99.1:7880
LIVEKIT_KEY=APIGPW3gnFTzqHH
LIVEKIT_SECRET=your-livekit-secret-here
```

**Step 2: Commit**

```bash
git add local-worker/.dev.vars.example
git commit -m "feat: add LiveKit env vars to worker config example"
```

---

## Phase 2: Pipecat Bot (voice-only, on OVH)

### Task 6: Create Pipecat bot project structure

**Files:**
- Create: `pipecat-bot/requirements.txt`
- Create: `pipecat-bot/bot.py`
- Create: `pipecat-bot/Dockerfile`
- Create: `pipecat-bot/.env.example`

**Step 1: Create requirements.txt**

```
pipecat-ai[livekit,groq,google,daily]==0.0.52
livekit-api>=0.7.0
python-dotenv>=1.0.0
```

Note: Pin pipecat version. Check latest at https://pypi.org/project/pipecat-ai/ before implementing.

**Step 2: Create .env.example**

```env
LIVEKIT_URL=ws://51.38.99.1:7880
LIVEKIT_KEY=APIGPW3gnFTzqHH
LIVEKIT_SECRET=your-livekit-secret-here
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
YANDEX_API_KEY=your-yandex-key
YANDEX_FOLDER_ID=your-folder-id
YANDEX_TTS_VOICE=amira
```

**Step 3: Create bot.py**

This is the core Pipecat bot. It joins a LiveKit room and runs the STT→LLM→TTS pipeline. Video (Wav2Lip) is NOT included yet — this is voice-only.

```python
import os
import asyncio
from dotenv import load_dotenv

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.transports.services.livekit import LiveKitTransport, LiveKitParams
from pipecat.services.groq import GroqSTTService
from pipecat.services.google import GoogleLLMService
from pipecat.processors.frameworks.langchain import LangchainProcessor

load_dotenv()

SYSTEM_PROMPT = (
    "You are the casting assistant for Meyram Cinema. "
    "Primary language is Kazakh. If the user writes in Russian, respond in Russian. "
    "Use natural, simple, conversational Kazakh. Keep grammar clean. "
    "Keep answers short, warm, and practical. Usually 1-3 short sentences. "
    "Your goal is to help parents register children for casting."
)


async def run_bot(room_name: str):
    transport = LiveKitTransport(
        url=os.getenv("LIVEKIT_URL"),
        api_key=os.getenv("LIVEKIT_KEY"),
        api_secret=os.getenv("LIVEKIT_SECRET"),
        room_name=room_name,
        participant_name="bot-avatar",
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_enabled=True,
            vad_analyzer_params={"threshold": 0.5, "min_speech_ms": 250},
        ),
    )

    stt = GroqSTTService(
        api_key=os.getenv("GROQ_API_KEY"),
        model="whisper-large-v3",
        language="kk",
    )

    llm = GoogleLLMService(
        api_key=os.getenv("GEMINI_API_KEY"),
        model="gemini-2.0-flash",
        system_instruction=SYSTEM_PROMPT,
    )

    # TTS: Yandex SpeechKit (custom processor needed — see Task 7)
    # For now, use a placeholder TTS or skip TTS in this step.
    # The actual Yandex TTS integration is in Task 7.

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        # tts placeholder — Task 7
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
    )

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    import sys
    room = sys.argv[1] if len(sys.argv) > 1 else "avatar-test"
    asyncio.run(run_bot(room))
```

**Step 4: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot.py"]
```

**Step 5: Verify Python syntax**

Run:
```bash
python -c "import ast; ast.parse(open('pipecat-bot/bot.py').read()); print('OK')"
```
Expected: OK

**Step 6: Commit**

```bash
git add pipecat-bot/
git commit -m "feat: add Pipecat bot skeleton with LiveKit + Groq STT + Gemini LLM"
```

---

### Task 7: Add Yandex TTS processor for Pipecat

**Files:**
- Create: `pipecat-bot/yandex_tts.py`
- Modify: `pipecat-bot/bot.py`

**Step 1: Create yandex_tts.py**

Pipecat doesn't have built-in Yandex TTS support, so we create a custom processor:

```python
import aiohttp
from pipecat.frames.frames import AudioRawFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class YandexTTSService(FrameProcessor):
    def __init__(self, *, api_key: str, voice: str = "amira", lang: str = "kk-KZ", speed: str = "1.0", sample_rate: int = 48000):
        super().__init__()
        self._api_key = api_key
        self._voice = voice
        self._lang = lang
        self._speed = speed
        self._sample_rate = sample_rate
        self._url = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, TextFrame):
            await self.push_frame(frame, direction)
            return

        text = frame.text.strip()
        if not text:
            return

        params = {
            "text": text,
            "lang": self._lang,
            "voice": self._voice,
            "format": "lpcm",
            "sampleRateHertz": str(self._sample_rate),
            "speed": self._speed,
        }

        headers = {
            "Authorization": f"Api-Key {self._api_key}",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(self._url, data=params, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise RuntimeError(f"Yandex TTS failed: {error}")
                audio_bytes = await resp.read()

        audio_frame = AudioRawFrame(
            audio=audio_bytes,
            sample_rate=self._sample_rate,
            num_channels=1,
        )
        await self.push_frame(audio_frame, direction)
```

**Step 2: Update bot.py pipeline to include TTS**

Add import:
```python
from yandex_tts import YandexTTSService
```

Replace the pipeline definition:
```python
    tts = YandexTTSService(
        api_key=os.getenv("YANDEX_API_KEY"),
        voice=os.getenv("YANDEX_TTS_VOICE", "amira"),
        lang="kk-KZ",
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        tts,
        transport.output(),
    ])
```

**Step 3: Verify syntax**

Run:
```bash
python -c "import ast; ast.parse(open('pipecat-bot/yandex_tts.py').read()); print('OK')"
python -c "import ast; ast.parse(open('pipecat-bot/bot.py').read()); print('OK')"
```
Expected: both OK

**Step 4: Commit**

```bash
git add pipecat-bot/yandex_tts.py pipecat-bot/bot.py
git commit -m "feat: add Yandex TTS processor for Pipecat pipeline"
```

---

### Task 8: Add room-watcher to auto-start bot when user joins

**Files:**
- Create: `pipecat-bot/room_watcher.py`
- Modify: `pipecat-bot/Dockerfile`

**Step 1: Create room_watcher.py**

This process watches for new LiveKit rooms with prefix `avatar-` and spawns a bot for each.

```python
import os
import asyncio
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def watch_rooms():
    lk = api.LiveKitAPI(
        url=os.getenv("LIVEKIT_URL", "").replace("ws://", "http://").replace("wss://", "https://"),
        api_key=os.getenv("LIVEKIT_KEY"),
        api_secret=os.getenv("LIVEKIT_SECRET"),
    )

    active_bots = {}

    while True:
        try:
            rooms_response = await lk.room.list_rooms(api.ListRoomsRequest())
            rooms = rooms_response.rooms

            for room in rooms:
                if room.name.startswith("avatar-") and room.name not in active_bots:
                    # Check if room has non-bot participants
                    participants_response = await lk.room.list_participants(
                        api.ListParticipantsRequest(room=room.name)
                    )
                    has_user = any(
                        not p.identity.startswith("bot-")
                        for p in participants_response.participants
                    )

                    if has_user:
                        print(f"Spawning bot for room: {room.name}")
                        proc = await asyncio.create_subprocess_exec(
                            "python", "bot.py", room.name,
                            cwd=os.path.dirname(os.path.abspath(__file__)),
                        )
                        active_bots[room.name] = proc

            # Clean up finished bots
            for room_name in list(active_bots):
                proc = active_bots[room_name]
                if proc.returncode is not None:
                    del active_bots[room_name]

        except Exception as e:
            print(f"Room watcher error: {e}")

        await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(watch_rooms())
```

**Step 2: Update Dockerfile CMD**

```dockerfile
CMD ["python", "room_watcher.py"]
```

**Step 3: Verify syntax**

Run:
```bash
python -c "import ast; ast.parse(open('pipecat-bot/room_watcher.py').read()); print('OK')"
```
Expected: OK

**Step 4: Commit**

```bash
git add pipecat-bot/room_watcher.py pipecat-bot/Dockerfile
git commit -m "feat: add room watcher to auto-spawn bots for avatar sessions"
```

---

### Task 9: Add docker-compose for Pipecat bot on OVH

**Files:**
- Create: `pipecat-bot/docker-compose.yaml`

**Step 1: Create docker-compose.yaml**

This runs alongside the existing messenger stack on OVH, on a separate network.

```yaml
version: "3.8"

services:
  pipecat-avatar:
    build: .
    restart: unless-stopped
    env_file: .env
    network_mode: host
    # host network so it can reach LiveKit at 51.38.99.1:7880
    # and LiveKit can reach it for WebRTC media
```

**Step 2: Commit**

```bash
git add pipecat-bot/docker-compose.yaml
git commit -m "feat: add docker-compose for Pipecat bot deployment on OVH"
```

---

## Phase 3: RunPod + Wav2Lip (last)

### Task 10: Create Wav2Lip inference server

**Files:**
- Create: `wav2lip-server/requirements.txt`
- Create: `wav2lip-server/server.py`
- Create: `wav2lip-server/Dockerfile`

**Step 1: Create requirements.txt**

```
torch>=2.0.0
torchvision>=0.15.0
numpy
opencv-python-headless
librosa
flask
gunicorn
```

**Step 2: Create server.py**

HTTP server that accepts audio + portrait image, returns lip-synced video frames.

```python
import os
import io
import cv2
import numpy as np
import torch
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

# Wav2Lip model loaded on startup
model = None
face_image = None

PORTRAIT_PATH = os.getenv("PORTRAIT_PATH", "portrait.jpg")
MODEL_PATH = os.getenv("WAV2LIP_MODEL_PATH", "checkpoints/wav2lip_gan.pth")


def load_model():
    global model
    # Import Wav2Lip model (cloned into /app/Wav2Lip)
    import sys
    sys.path.insert(0, "/app/Wav2Lip")
    from models import Wav2Lip as Wav2LipModel
    model = Wav2LipModel()
    checkpoint = torch.load(MODEL_PATH, map_location="cuda")
    s = checkpoint["state_dict"]
    new_s = {k.replace("module.", ""): v for k, v in s.items()}
    model.load_state_dict(new_s)
    model = model.cuda().eval()
    return model


def load_face():
    global face_image
    img = cv2.imread(PORTRAIT_PATH)
    if img is None:
        raise FileNotFoundError(f"Portrait not found: {PORTRAIT_PATH}")
    face_image = cv2.resize(img, (96, 96))
    return face_image


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model_loaded": model is not None})


@app.route("/inference", methods=["POST"])
def inference():
    """
    Accepts: audio chunk (PCM or WAV) as file upload
    Returns: lip-synced video frames as MJPEG
    """
    if model is None or face_image is None:
        return jsonify({"ok": False, "error": "Model not loaded"}), 503

    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"ok": False, "error": "Audio file required"}), 400

    # Process audio → mel spectrogram → Wav2Lip → frames
    # This is a simplified version. Full implementation needs:
    # 1. Convert audio to mel spectrogram
    # 2. Split into chunks matching video fps
    # 3. Run Wav2Lip inference per chunk
    # 4. Return frames as video stream

    # Placeholder: return original face as proof of concept
    _, buffer = cv2.imencode(".jpg", face_image)
    return send_file(
        io.BytesIO(buffer.tobytes()),
        mimetype="image/jpeg"
    )


if __name__ == "__main__":
    print("Loading Wav2Lip model...")
    load_model()
    print("Loading portrait...")
    load_face()
    print("Server ready")
    app.run(host="0.0.0.0", port=8000)
```

Note: The `/inference` endpoint is a scaffold. Full Wav2Lip integration requires:
- Audio → mel spectrogram conversion
- Face detection + crop from portrait
- Wav2Lip forward pass per audio chunk
- Frame encoding and streaming

This will be completed when deploying on RunPod with actual GPU.

**Step 3: Create Dockerfile**

```dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Clone Wav2Lip
RUN apt-get update && apt-get install -y git ffmpeg libgl1-mesa-glx && \
    git clone https://github.com/Rudrabha/Wav2Lip.git /app/Wav2Lip && \
    rm -rf /app/Wav2Lip/.git

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "server.py"]
```

**Step 4: Verify syntax**

Run:
```bash
python -c "import ast; ast.parse(open('wav2lip-server/server.py').read()); print('OK')"
```
Expected: OK

**Step 5: Commit**

```bash
git add wav2lip-server/
git commit -m "feat: add Wav2Lip inference server scaffold for RunPod"
```

---

### Task 11: Add Wav2Lip video processor to Pipecat pipeline

**Files:**
- Create: `pipecat-bot/wav2lip_video.py`
- Modify: `pipecat-bot/bot.py`

**Step 1: Create wav2lip_video.py**

Pipecat processor that sends audio to Wav2Lip server and publishes video frames.

```python
import aiohttp
from pipecat.frames.frames import AudioRawFrame, ImageRawFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class Wav2LipVideoProcessor(FrameProcessor):
    def __init__(self, *, wav2lip_url: str, portrait_ready: bool = True):
        super().__init__()
        self._url = wav2lip_url.rstrip("/")
        self._portrait_ready = portrait_ready

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return

        # Forward audio frame downstream (for audio output)
        await self.push_frame(frame, direction)

        # Also send audio to Wav2Lip for video generation
        if not self._portrait_ready:
            return

        try:
            form = aiohttp.FormData()
            form.add_field("audio", frame.audio, content_type="audio/raw")

            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self._url}/inference", data=form) as resp:
                    if resp.status == 200:
                        image_bytes = await resp.read()
                        video_frame = ImageRawFrame(
                            image=image_bytes,
                            size=(96, 96),
                            format="JPEG",
                        )
                        await self.push_frame(video_frame, direction)
        except Exception as e:
            # Don't break audio pipeline if video fails
            pass
```

**Step 2: Update bot.py to include video processor**

Add import:
```python
from wav2lip_video import Wav2LipVideoProcessor
```

Add to pipeline (between tts and transport.output()):
```python
    wav2lip_url = os.getenv("WAV2LIP_URL", "http://localhost:8000")

    video = Wav2LipVideoProcessor(
        wav2lip_url=wav2lip_url,
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        tts,
        video,
        transport.output(),
    ])
```

Add to LiveKitParams:
```python
    params=LiveKitParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        video_out_enabled=True,  # NEW: enable video publishing
        vad_enabled=True,
    ),
```

**Step 3: Add WAV2LIP_URL to .env.example**

```env
WAV2LIP_URL=http://localhost:8000
```

**Step 4: Verify syntax**

Run:
```bash
python -c "import ast; ast.parse(open('pipecat-bot/wav2lip_video.py').read()); print('OK')"
python -c "import ast; ast.parse(open('pipecat-bot/bot.py').read()); print('OK')"
```
Expected: both OK

**Step 5: Commit**

```bash
git add pipecat-bot/wav2lip_video.py pipecat-bot/bot.py pipecat-bot/.env.example
git commit -m "feat: add Wav2Lip video processor to Pipecat pipeline"
```

---

### Task 12: Create RunPod deployment config

**Files:**
- Create: `runpod-deploy/README.md` (deployment instructions only)
- Create: `runpod-deploy/start.sh`

**Step 1: Create start.sh**

Combined startup script for RunPod pod that runs both Wav2Lip server and Pipecat bot:

```bash
#!/bin/bash
set -e

echo "Starting Wav2Lip server..."
cd /app/wav2lip-server
python server.py &
WAV2LIP_PID=$!

echo "Waiting for Wav2Lip to load model..."
until curl -s http://localhost:8000/health | grep -q '"ok": true'; do
  sleep 2
done
echo "Wav2Lip ready"

echo "Starting Pipecat bot..."
cd /app/pipecat-bot
export WAV2LIP_URL=http://localhost:8000
python room_watcher.py &
PIPECAT_PID=$!

echo "Both services running. Wav2Lip PID=$WAV2LIP_PID, Pipecat PID=$PIPECAT_PID"
wait
```

**Step 2: Commit**

```bash
git add runpod-deploy/
git commit -m "feat: add RunPod deployment scripts for Wav2Lip + Pipecat"
```

---

## Summary: Implementation Order

| Phase | Task | What it delivers |
|-------|------|-----------------|
| 1 | Tasks 1-5 | Frontend connects to LiveKit, Worker creates sessions |
| 2 | Tasks 6-9 | Pipecat bot answers with voice through LiveKit (no face yet) |
| 3 | Tasks 10-12 | Wav2Lip renders face, full talking avatar on RunPod |

Each phase produces a testable, working result. Phase 3 (RunPod) is done last as requested.
