# Ditto Avatar + Yandex TTS (Жанар) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Wav2Lip with Ditto talking head and KazakhTTS2 with Yandex SpeechKit (voice Жанар), simplify frontend to LiveKit-only mode.

**Architecture:** Single RunPod container (RTX 3090) runs Ditto inference server (:8000) and Pipecat bot. Pipecat pipeline: Silero VAD → Groq STT → Gemini LLM → Yandex TTS (Жанар) → Ditto video → LiveKit. Frontend connects via LiveKit WebRTC only — no browser-side STT/LLM/TTS.

**Tech Stack:** Ditto (antgroup/ditto-talkinghead), Pipecat 0.0.52, LiveKit, Yandex SpeechKit API, Groq Whisper, Gemini 2.0 Flash, Python 3.10, PyTorch 2.5.1, TensorRT 8.6.1

---

### Task 1: Create Yandex TTS Pipecat Processor

**Files:**
- Create: `pipecat-bot/yandex_tts.py`

**Step 1: Create the Yandex TTS processor**

```python
"""
Yandex SpeechKit TTS — Pipecat processor.
Voice: Жанар (Kazakh). Returns raw PCM audio frames.
"""

import os
import io
import struct
import aiohttp
from pipecat.frames.frames import AudioRawFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class YandexTTSService(FrameProcessor):
    def __init__(
        self,
        *,
        api_key: str = None,
        voice: str = "zhanar",
        lang: str = "kk-KZ",
        speed: str = "1.0",
        sample_rate: int = 48000,
    ):
        super().__init__()
        self._api_key = api_key or os.getenv("YANDEX_API_KEY")
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

        async with aiohttp.ClientSession() as session:
            async with session.post(
                self._url,
                headers={
                    "Authorization": f"Api-Key {self._api_key}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=params,
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    print(f"[yandex-tts] Error: {error}")
                    return

                audio_bytes = await resp.read()

        audio_frame = AudioRawFrame(
            audio=audio_bytes,
            sample_rate=self._sample_rate,
            num_channels=1,
        )
        await self.push_frame(audio_frame, direction)
```

**Step 2: Commit**

```bash
git add pipecat-bot/yandex_tts.py
git commit -m "feat: add Yandex TTS (Жанар) Pipecat processor"
```

---

### Task 2: Create Ditto Inference Server

**Files:**
- Create: `ditto-server/server.py`

**Step 1: Create the Ditto HTTP server**

This wraps Ditto's `StreamSDK` (online mode) as an HTTP service. It accepts audio chunks and returns video frames.

```python
"""
Ditto talking head inference server.
Accepts audio PCM → returns JPEG video frames (512x512).
Runs on :8000.
"""

import os
import io
import math
import threading
import queue
import numpy as np
import cv2
import librosa
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

SDK = None
PORTRAIT_PATH = os.getenv("PORTRAIT_PATH", "/app/ditto-server/portrait.png")
DITTO_DATA_ROOT = os.getenv("DITTO_DATA_ROOT", "/app/checkpoints/ditto_trt_Ampere_Plus")
DITTO_CFG_PKL = os.getenv("DITTO_CFG_PKL", "/app/checkpoints/ditto_cfg/v0.4_hubert_cfg_trt_online.pkl")
FRAME_QUEUE = queue.Queue(maxsize=100)


class FrameCollector:
    """Replaces Ditto's VideoWriter — collects frames into a queue instead of writing to file."""
    def __init__(self, frame_queue):
        self._queue = frame_queue

    def write(self, frame):
        # frame is RGB numpy array
        _, buffer = cv2.imencode(".jpg", cv2.cvtColor(frame, cv2.COLOR_RGB2BGR),
                                  [cv2.IMWRITE_JPEG_QUALITY, 85])
        self._queue.put(buffer.tobytes())

    def close(self):
        self._queue.put(None)  # sentinel


def load_model():
    global SDK
    import sys
    sys.path.insert(0, "/app/ditto-talkinghead")
    from stream_pipeline_online import StreamSDK

    SDK = StreamSDK(
        cfg_pkl=DITTO_CFG_PKL,
        data_root=DITTO_DATA_ROOT,
    )
    # Register portrait — do once at startup
    SDK.setup(
        source_path=PORTRAIT_PATH,
        output_path="/tmp/ditto_placeholder.mp4",
        online_mode=True,
        max_size=512,
    )
    print("[ditto] Model loaded, portrait registered")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model_loaded": SDK is not None})


@app.route("/inference", methods=["POST"])
def inference():
    """
    Accepts: raw PCM audio (16kHz mono int16) as binary body or file upload.
    Returns: multipart JPEG frames.
    """
    if SDK is None:
        return jsonify({"ok": False, "error": "Model not loaded"}), 503

    audio_file = request.files.get("audio")
    if audio_file:
        audio_bytes = audio_file.read()
    else:
        audio_bytes = request.get_data()

    if not audio_bytes:
        return jsonify({"ok": False, "error": "No audio provided"}), 400

    # Convert PCM int16 to float32
    audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
    audio_float = audio_int16.astype(np.float32) / 32768.0

    # Ditto expects 16kHz
    # If audio is 48kHz (from Yandex TTS), resample
    sample_rate = int(request.args.get("sr", 48000))
    if sample_rate != 16000:
        audio_float = librosa.resample(audio_float, orig_sr=sample_rate, target_sr=16000)

    num_frames = math.ceil(len(audio_float) / 16000 * 25)
    if num_frames == 0:
        return jsonify({"ok": False, "error": "Audio too short"}), 400

    # Run Ditto online inference
    frame_queue = queue.Queue(maxsize=100)
    SDK.setup_Nd(N_d=num_frames)

    chunksize = (3, 5, 2)  # Ditto online mode chunk config
    chunk_samples = chunksize[1] * 640  # 5 * 640 = 3200 samples per chunk

    frames = []
    for i in range(0, len(audio_float), chunk_samples):
        chunk = audio_float[i:i + chunk_samples]
        if len(chunk) < chunk_samples:
            chunk = np.pad(chunk, (0, chunk_samples - len(chunk)))
        result_frames = SDK.run_chunk(chunk, chunksize)
        if result_frames:
            for f in result_frames:
                _, buffer = cv2.imencode(".jpg", cv2.cvtColor(f, cv2.COLOR_RGB2BGR),
                                          [cv2.IMWRITE_JPEG_QUALITY, 85])
                frames.append(buffer.tobytes())

    if not frames:
        return jsonify({"ok": False, "error": "No frames generated"}), 500

    # Return frames as multipart response
    def generate():
        for frame_bytes in frames:
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n"
                   b"Content-Length: " + str(len(frame_bytes)).encode() + b"\r\n\r\n"
                   + frame_bytes + b"\r\n")
        yield b"--frame--\r\n"

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    print("[ditto] Loading model...")
    load_model()
    print("[ditto] Server ready on :8000")
    app.run(host="0.0.0.0", port=8000)
```

**Step 2: Commit**

```bash
git add ditto-server/server.py
git commit -m "feat: add Ditto talking head inference server"
```

---

### Task 3: Create Ditto Video Pipecat Processor

**Files:**
- Create: `pipecat-bot/ditto_video.py`

**Step 1: Create the Ditto video processor**

```python
"""
Ditto video processor for Pipecat.
Sends audio frames to Ditto server, receives JPEG video frames.
"""

import aiohttp
from pipecat.frames.frames import AudioRawFrame, ImageRawFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class DittoVideoProcessor(FrameProcessor):
    def __init__(self, *, ditto_url: str = "http://localhost:8000"):
        super().__init__()
        self._url = ditto_url.rstrip("/")
        self._audio_buffer = bytearray()
        self._sample_rate = 48000
        # Buffer ~0.4s of audio before sending (Ditto online chunk size)
        self._chunk_bytes = int(0.4 * self._sample_rate * 2)  # 16-bit = 2 bytes per sample

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return

        # Always forward audio downstream (for LiveKit audio output)
        await self.push_frame(frame, direction)

        # Buffer audio for Ditto
        self._audio_buffer.extend(frame.audio)

        if len(self._audio_buffer) < self._chunk_bytes:
            return

        # Send buffered audio to Ditto
        audio_chunk = bytes(self._audio_buffer)
        self._audio_buffer.clear()

        try:
            form = aiohttp.FormData()
            form.add_field("audio", audio_chunk, content_type="audio/raw")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self._url}/inference?sr={self._sample_rate}",
                    data=form,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status != 200:
                        return

                    # Parse multipart JPEG frames
                    body = await resp.read()
                    jpeg_frames = self._parse_multipart_frames(body)

                    for jpeg_bytes in jpeg_frames:
                        video_frame = ImageRawFrame(
                            image=jpeg_bytes,
                            size=(512, 512),
                            format="JPEG",
                        )
                        await self.push_frame(video_frame, direction)
        except Exception:
            pass  # Don't break audio pipeline if video fails

    def _parse_multipart_frames(self, body: bytes) -> list:
        """Parse multipart/x-mixed-replace response into JPEG frames."""
        frames = []
        parts = body.split(b"--frame")
        for part in parts:
            # Find JPEG data (starts with FF D8)
            start = part.find(b"\xff\xd8")
            if start >= 0:
                end = part.rfind(b"\xff\xd9")
                if end >= 0:
                    frames.append(part[start:end + 2])
        return frames
```

**Step 2: Commit**

```bash
git add pipecat-bot/ditto_video.py
git commit -m "feat: add Ditto video Pipecat processor"
```

---

### Task 4: Update bot.py — Wire New Pipeline

**Files:**
- Modify: `pipecat-bot/bot.py`

**Step 1: Replace KazakhTTS2 and Wav2Lip with Yandex TTS and Ditto**

```python
import os
import sys
import asyncio
from dotenv import load_dotenv

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.transports.services.livekit import LiveKitTransport, LiveKitParams
from pipecat.services.groq import GroqSTTService
from pipecat.services.google import GoogleLLMService
from pipecat.audio.vad.silero import SileroVADAnalyzer
from yandex_tts import YandexTTSService
from ditto_video import DittoVideoProcessor

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
            video_out_enabled=True,
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(
                sample_rate=16000,
                params=SileroVADAnalyzer.VADParams(
                    confidence=0.6,
                    start_secs=0.2,
                    stop_secs=0.4,
                    min_volume=0.4,
                ),
            ),
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

    tts = YandexTTSService(
        api_key=os.getenv("YANDEX_API_KEY"),
        voice="zhanar",
        lang="kk-KZ",
        sample_rate=48000,
    )

    ditto_url = os.getenv("DITTO_URL", "http://localhost:8000")
    video = DittoVideoProcessor(ditto_url=ditto_url)

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        tts,
        video,
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
    )

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    room = sys.argv[1] if len(sys.argv) > 1 else "avatar-test"
    asyncio.run(run_bot(room))
```

**Step 2: Commit**

```bash
git add pipecat-bot/bot.py
git commit -m "feat: wire Yandex TTS (Жанар) + Ditto into Pipecat pipeline"
```

---

### Task 5: Update Dockerfile for Ditto

**Files:**
- Modify: `runpod-deploy/Dockerfile`

**Step 1: Rewrite Dockerfile for Ditto stack**

```dockerfile
###############################################################################
# RunPod unified image: Pipecat + Yandex TTS + Ditto Talking Head
# GPU: RTX 3090 (24GB VRAM) — ~$0.22/hr on RunPod
# All services on one pod = 0ms inter-service latency
###############################################################################
FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

WORKDIR /app

# ── system deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libsndfile1 libgl1-mesa-glx curl && \
    rm -rf /var/lib/apt/lists/*

# ── Ditto source ─────────────────────────────────────────────────────────────
RUN git clone https://github.com/antgroup/ditto-talkinghead.git /app/ditto-talkinghead && \
    rm -rf /app/ditto-talkinghead/.git

# ── Ditto model weights (HuggingFace) ────────────────────────────────────────
RUN pip install --no-cache-dir huggingface_hub && \
    python -c "from huggingface_hub import snapshot_download; snapshot_download('digital-avatar/ditto-talkinghead', local_dir='/app/checkpoints')"

# ── Python deps ──────────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Ditto deps ───────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir \
    tensorrt==8.6.1 librosa tqdm filetype imageio opencv-python-headless \
    scikit-image cython cuda-python imageio-ffmpeg polygraphy "numpy==2.0.1"

# ── Copy application code ───────────────────────────────────────────────────
COPY ../pipecat-bot /app/pipecat-bot
COPY ../ditto-server /app/ditto-server
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# ── Portrait image ───────────────────────────────────────────────────────────
# Place your avatar portrait as portrait.png in ditto-server/
# Or mount at runtime: -v /path/to/portrait.png:/app/ditto-server/portrait.png

ENV DITTO_DATA_ROOT=/app/checkpoints/ditto_trt_Ampere_Plus
ENV DITTO_CFG_PKL=/app/checkpoints/ditto_cfg/v0.4_hubert_cfg_trt_online.pkl
ENV DITTO_URL=http://localhost:8000
ENV PORTRAIT_PATH=/app/ditto-server/portrait.png

EXPOSE 8000

CMD ["/app/start.sh"]
```

**Step 2: Update requirements.txt**

Remove KazakhTTS2/ESPnet deps, add Ditto and aiohttp for Yandex TTS calls:

```
pipecat-ai[google,groq,silero,livekit]==0.0.52
aiohttp>=3.9
flask>=3.0
python-dotenv
livekit-api>=0.7
```

**Step 3: Commit**

```bash
git add runpod-deploy/Dockerfile runpod-deploy/requirements.txt
git commit -m "feat: update Dockerfile for Ditto + Yandex TTS stack"
```

---

### Task 6: Update start.sh

**Files:**
- Modify: `runpod-deploy/start.sh`

**Step 1: Rewrite startup script**

```bash
#!/bin/bash
set -e

echo "============================================"
echo " Meyram Cinema Avatar — RunPod Startup"
echo " Yandex TTS (Жанар) + Ditto + Pipecat"
echo "============================================"

# ── 1. Start Ditto server ─────────────────────────────────────────────────
echo "[1/3] Starting Ditto server on :8000..."
cd /app/ditto-server
python server.py &
DITTO_PID=$!

echo "[2/3] Waiting for Ditto model to load..."
for i in $(seq 1 120); do
    if curl -sf http://localhost:8000/health | grep -q '"ok": true'; then
        echo "       Ditto ready (took ~${i}s)"
        break
    fi
    if [ $i -eq 120 ]; then
        echo "       WARNING: Ditto health check timed out, continuing anyway..."
    fi
    sleep 1
done

# ── 2. Start Pipecat bot (room watcher) ─────────────────────────────────────
echo "[3/3] Starting Pipecat room watcher..."
cd /app/pipecat-bot
export DITTO_URL=http://localhost:8000
python room_watcher.py &
PIPECAT_PID=$!

echo "============================================"
echo " All services running!"
echo "   Ditto  PID=$DITTO_PID"
echo "   Pipecat PID=$PIPECAT_PID"
echo ""
echo " Stack:"
echo "   STT:   Groq Whisper (cloud)"
echo "   LLM:   Gemini 2.0 Flash (cloud)"
echo "   TTS:   Yandex SpeechKit — Жанар (cloud)"
echo "   VAD:   Silero — local (stop_secs=0.4)"
echo "   Video: Ditto — local GPU (512x512, 40 FPS)"
echo "============================================"

# Keep container alive
wait
```

**Step 2: Commit**

```bash
git add runpod-deploy/start.sh
git commit -m "feat: update start.sh for Ditto startup"
```

---

### Task 7: Simplify Frontend — LiveKit Only

**Files:**
- Modify: `app.js`
- Modify: `local-worker/worker.js`

**Step 1: Simplify app.js**

Strip out browser-mode STT/LLM/TTS orchestration. Keep only:
- LiveKit connection via `livekit-avatar.js`
- Video display (512x512)
- Microphone publish
- Lead form (text-based, calls `/lead` endpoint)
- Widget UI (open/close, hero slider stays)

Remove:
- `startVoiceCapture()`, `stopVoiceCapture()` — no browser VAD needed
- `transcribeAudio()`, `sendChat()`, `synthesizeSpeech()` — Pipecat handles these
- MediaRecorder/AudioContext VAD logic
- All `/transcribe`, `/chat`, `/tts` fetch calls

The avatar video element should be 512x512, displayed in the widget area.

**Step 2: Update normalizeYandexVoice in worker.js**

In `local-worker/worker.js` line 1143, add "zhanar" to allowed voices:

```javascript
function normalizeYandexVoice(voice) {
  const normalized = String(voice || "").trim().toLowerCase();
  return ["amira", "madi", "zhanar"].includes(normalized) ? normalized : "zhanar";
}
```

Also update default voice from "amira" to "zhanar" in lines 670, 874, 974.

**Step 3: Remove unused Worker endpoints**

Keep only:
- `POST /avatar-session` — creates LiveKit room + token
- `POST /lead` — Telegram lead submission
- `POST /session` — session init (simplified)
- `OPTIONS` — CORS preflight

Remove handlers for: `/transcribe`, `/chat`, `/tts`

**Step 4: Commit**

```bash
git add app.js local-worker/worker.js
git commit -m "feat: simplify frontend to LiveKit-only, update Yandex voice to Жанар"
```

---

### Task 8: Cleanup Old Files

**Files:**
- Delete: `pipecat-bot/kazakh_tts.py`
- Delete: `wav2lip-server/server.py`
- Delete: `pipecat-bot/wav2lip_video.py`
- Delete: `pipecat-bot/Dockerfile` (use only runpod-deploy/Dockerfile)

**Step 1: Remove old files**

```bash
git rm pipecat-bot/kazakh_tts.py
git rm pipecat-bot/wav2lip_video.py
git rm -r wav2lip-server/
git rm pipecat-bot/Dockerfile
```

**Step 2: Commit**

```bash
git commit -m "chore: remove Wav2Lip and KazakhTTS2 files"
```

---

### Task 9: Add Portrait Image Placeholder

**Files:**
- Create: `ditto-server/.gitkeep`

**Step 1: Create ditto-server directory**

```bash
mkdir -p ditto-server
touch ditto-server/.gitkeep
```

Note: actual `portrait.png` (512x512 face photo) must be provided by the user and placed in `ditto-server/portrait.png` or mounted at runtime.

**Step 2: Commit**

```bash
git add ditto-server/.gitkeep
git commit -m "chore: add ditto-server directory"
```

---

### Task 10: Update .env Template

**Files:**
- Modify: `pipecat-bot/.env.example` (create if not exists)

**Step 1: Create env template**

```env
# LiveKit
LIVEKIT_URL=ws://51.38.99.1:7880
LIVEKIT_KEY=your-key
LIVEKIT_SECRET=your-secret

# STT (Groq)
GROQ_API_KEY=your-groq-key

# LLM (Gemini)
GEMINI_API_KEY=your-gemini-key

# TTS (Yandex SpeechKit)
YANDEX_API_KEY=your-yandex-key

# Ditto
DITTO_URL=http://localhost:8000
```

**Step 2: Commit**

```bash
git add pipecat-bot/.env.example
git commit -m "docs: add .env.example for new stack"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Yandex TTS processor | `pipecat-bot/yandex_tts.py` |
| 2 | Ditto inference server | `ditto-server/server.py` |
| 3 | Ditto video Pipecat processor | `pipecat-bot/ditto_video.py` |
| 4 | Wire new pipeline in bot.py | `pipecat-bot/bot.py` |
| 5 | Update Dockerfile | `runpod-deploy/Dockerfile`, `requirements.txt` |
| 6 | Update start.sh | `runpod-deploy/start.sh` |
| 7 | Simplify frontend + worker | `app.js`, `worker.js` |
| 8 | Delete old files | `kazakh_tts.py`, `wav2lip_video.py`, `wav2lip-server/` |
| 9 | Ditto server directory | `ditto-server/` |
| 10 | Env template | `.env.example` |
