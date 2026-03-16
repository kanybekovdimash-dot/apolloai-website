# Own Simli: Real-time Talking Avatar for Meyram Cinema

## Summary

Build an internal real-time talking avatar service (like Simli, but self-hosted) using Pipecat + Wav2Lip + LiveKit. The avatar takes a portrait photo, receives audio from TTS, and produces a lip-synced video stream delivered to the browser via WebRTC.

## Requirements

- Real face lip-sync (photo of a real person animated by audio)
- True realtime: <500ms latency
- WebRTC video stream in the browser widget
- Internal use only (Meyram Cinema, future messenger, streamers)
- Must not break the existing messenger on OVH

## Architecture

```
Браузер (сайт Meyram)
    │
    │ WebRTC
    ▼
LiveKit (OVH, 51.38.99.1:7880)  ← already running, shared with messenger
    │
    │ WebRTC (one hop)
    ▼
Pipecat + Wav2Lip (RunPod, GPU T4 8GB)  ← same pod, local communication
    │
    ├── Groq STT (API)
    ├── Gemini LLM (API)
    └── Yandex TTS (API)
```

### Key decisions

- **Pipecat and Wav2Lip on the same RunPod pod** — local communication = 0ms between them. Critical for <500ms target.
- **LiveKit on OVH** — already deployed, reused from messenger. Avatar uses separate rooms (`avatar-{sessionId}`), no interference with messenger rooms.
- **Wav2Lip over MuseTalk** — lighter (8GB vs 16GB VRAM), faster inference, cheaper ($0.20/hr vs $0.49/hr). Can upgrade to MuseTalk later.

## Components

| # | Component | What it does | Where |
|---|-----------|-------------|-------|
| 1 | Frontend (app.js) | Connects to LiveKit, shows video track in avatar widget | Cloudflare (site) |
| 2 | Worker endpoint | `/avatar-session` — creates LiveKit room, returns token | Cloudflare Worker |
| 3 | Pipecat bot | Python pipeline: STT → LLM → TTS → Wav2Lip, manages conversation | RunPod GPU |
| 4 | Wav2Lip server | Docker container with model, takes audio+photo → video frames | RunPod GPU (same pod) |
| 5 | LiveKit room | WebRTC transport, room per session | OVH (existing) |

## Data flow

```
User speaks:
  Browser mic → WebRTC → LiveKit (OVH) → Pipecat (RunPod)

Pipecat pipeline (all on RunPod):
  1. Audio → Groq STT → text           (~200ms)
  2. Text  → Gemini LLM → reply        (~300ms)
  3. Reply → Yandex TTS → audio        (~200ms)
  4. Audio + photo → Wav2Lip → video   (~100ms/frame)

Avatar responds:
  Pipecat → video+audio track → LiveKit (OVH) → WebRTC → Browser <video>
```

## Implementation order

1. **Frontend + Worker** — LiveKit connection in widget, `/avatar-session` endpoint
2. **Pipecat bot on OVH** — voice-only bot through LiveKit (STT → LLM → TTS, no face yet)
3. **RunPod + Wav2Lip** — GPU face rendering, migrate Pipecat to RunPod pod

Each stage produces a working result.

## What changes in existing code

- `app.js` — replace browser voice loop with LiveKit room connection
- `worker.js` — add `/avatar-session` endpoint (LiveKit token generation)
- `index.html` — minimal: `<video id="avatarVideo">` already exists

## What does NOT change

- Messenger on OVH — untouched
- LiveKit config — untouched, just new rooms
- Site design — widget stays, only video source changes

## Costs per conversation (~3 min)

| Component | Cost |
|-----------|------|
| LiveKit (OVH) | $0 (already running) |
| Pipecat (same pod) | $0 (no extra cost) |
| Wav2Lip (RunPod T4) | ~$0.01-0.02 |
| Groq STT | ~$0.006/min (free tier available) |
| Gemini LLM | free tier |
| Yandex TTS | already paid |
| **Total** | **< $0.05/conversation** |

## Future upgrades

- Replace Wav2Lip with MuseTalk for better quality
- Add TURN server (coturn) for WebRTC behind restrictive NATs
- Add SSL to LiveKit (`wss://`)
- Reuse for messenger AI avatars and AI streamers
