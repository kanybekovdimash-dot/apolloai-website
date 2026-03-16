# Ditto Avatar + Yandex TTS (Жанар) — Design

**Date**: 2026-03-16
**Status**: Approved

## Architecture

```
Browser (apolloai.biz)
  └── LiveKit Client → video 512x512 + audio
        │
LiveKit Server (OVH ws://51.38.99.1:7880)
        │
RunPod (RTX 3090, single container)
  ├── Ditto Server (:8000) — audio PCM → video frames 512x512
  ├── Pipecat Bot
  │     ├── Silero VAD (16kHz, confidence 0.6)
  │     ├── Groq Whisper (STT, kk)
  │     ├── Gemini 2.0 Flash (LLM)
  │     ├── Yandex SpeechKit (TTS, voice "zhanar", lang kk-KZ)
  │     └── Ditto Video Processor → frames → LiveKit
  └── room_watcher.py — spawns bots per room
```

## Pipeline

```
Audio In → Silero VAD → Groq STT → Gemini LLM → Yandex TTS (Жанар) → Ditto → LiveKit Out
```

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Avatar model | Ditto (40 FPS, RTX 3090) | Real-time, open source, good quality |
| TTS | Yandex SpeechKit, voice Жанар | Production quality Kazakh voice |
| Resolution | 512x512 | Good quality for widget |
| Delivery | LiveKit WebRTC only | Single mode, simpler |
| Deployment | One container on RunPod | 0ms latency between services |
| Ditto mode | Online (streaming) | Low latency for conversation |

## What Changes

### Remove
- `pipecat-bot/kazakh_tts.py` — replaced by Yandex TTS
- `wav2lip-server/` — replaced by Ditto Server
- Worker endpoints: `/transcribe`, `/chat`, `/tts` — no longer needed
- Browser VAD logic in app.js — server-side VAD handles it
- Browser-mode orchestration in app.js — LiveKit only

### Add
- `pipecat-bot/yandex_tts.py` — Pipecat processor calling Yandex SpeechKit API
- `ditto-server/server.py` — Ditto HTTP inference server (:8000)
- `ditto-server/portrait.png` — fixed avatar face image
- `pipecat-bot/ditto_video.py` — Pipecat processor sending audio to Ditto, receiving frames

### Modify
- `pipecat-bot/bot.py` — swap KazakhTTS2 → Yandex TTS, Wav2Lip → Ditto
- `runpod-deploy/Dockerfile` — Ditto instead of Wav2Lip, remove KazakhTTS2
- `runpod-deploy/start.sh` — start Ditto server instead of Wav2Lip
- `app.js` — simplify to LiveKit-only client
- `livekit-avatar.js` — no changes needed
- `local-worker/worker.js` — keep only `/avatar-session` and `/lead`

## Ditto Server API

### POST /inference
- Input: audio PCM bytes (16kHz mono int16)
- Output: JPEG frames (512x512) streamed or batched
- Ditto online mode: chunks of ~0.4s audio → 5 video frames per chunk

### GET /health
- Returns: `{"ok": true, "model_loaded": true}`

## Yandex TTS Processor

- Endpoint: `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize`
- Voice: `zhanar` (Kazakh)
- Language: `kk-KZ`
- Format: `lpcm` (raw PCM for Pipecat pipeline)
- Sample rate: 48kHz
- Auth: `Api-Key` header

## Frontend (Simplified app.js)

1. Call `/avatar-session` → get LiveKit token
2. Connect to LiveKit room
3. Publish microphone track
4. Display received video (512x512) + play audio
5. Lead form collection stays (text-based via data channel or separate endpoint)
