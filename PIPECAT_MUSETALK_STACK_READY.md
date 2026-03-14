# Pipecat + MuseTalk Stack Ready

## What is already prepared

- Site widget works as a voice-controller shell in the bottom-right corner.
- The widget requests microphone access on load and can re-request it on avatar click.
- Avatar UI now has explicit runtime states: `idle`, `listening`, `thinking`, `speaking`.
- The site can already run this loop:
  1. microphone capture
  2. `POST /transcribe`
  3. `POST /chat`
  4. `POST /tts`
  5. play returned speech audio
- Cloudflare Worker defaults are prepared for:
  - chat: `Gemini`
  - STT: `Groq`
  - TTS: `Yandex SpeechKit`
  - avatar provider label: `Pipecat + MuseTalk`

## Current frontend behavior

The current site no longer depends on a full external demo UI as the primary behavior.
It is now prepared to act as our own controller shell first, and later accept a real MuseTalk-rendered video/avatar stream.

Configured files:
- `index.html`
- `app.js`
- `styles.css`

## Current Cloudflare worker behavior

Prepared worker files:
- `local-worker/worker.js`
- `local-worker/.dev.vars.example`

Important endpoints already available:
- `POST /session`
- `POST /chat`
- `POST /lead`
- `POST /transcribe`
- `POST /tts`

## Required env for the current non-GPU stack

At minimum:

```env
GEMINI_API_KEY=
GROQ_API_KEY=
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
YANDEX_TTS_VOICE=amira
TTS_PROVIDER=yandex
CHAT_PROVIDER=gemini
STT_PROVIDER=groq
```

Optional avatar-related env prepared in advance:

```env
AVATAR_PROVIDER=Pipecat + MuseTalk
AVATAR_POSTER_URL=
AVATAR_PREVIEW_URL=
AVATAR_VIDEO_URL=
AVATAR_STREAM_URL=
AVATAR_AUDIO_URL=
RUNPOD_BASE_URL=
RUNPOD_API_KEY=
RUNPOD_CHAT_URL=
RUNPOD_STT_URL=
RUNPOD_TTS_URL=
```

## What remains for RunPod day

Only the GPU/avatar layer:

1. Raise RunPod with MuseTalk.
2. Expose MuseTalk inference endpoint or stream endpoint.
3. Set avatar envs in the worker: `AVATAR_POSTER_URL`, `AVATAR_VIDEO_URL` or `AVATAR_STREAM_URL`.
4. If MuseTalk is wrapped behind Pipecat, point the worker/site session metadata to that runtime.
5. Keep the current site controller shell; do not reintroduce a full third-party demo iframe as the main UX.

## Recommended architecture

- Site: bottom-right avatar controller shell
- Worker: Cloudflare orchestration API
- STT: Groq
- LLM: Gemini
- TTS: Yandex SpeechKit
- Realtime/controller layer: Pipecat
- Avatar renderer on GPU: MuseTalk

## Verification completed locally

- `node --check app.js`
- `node --check local-worker/worker.js`
- `npm run build`

## Important note

The exact portrait image of the final girl avatar is not baked into the repo yet.
The code is already prepared for it via `apollo-avatar-poster-url` and `AVATAR_POSTER_URL`.
