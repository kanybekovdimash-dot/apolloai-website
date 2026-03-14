# Avatar / Voice Retrospective

Date: March 14, 2026

## Goal

Build a site experience for `apolloai.biz` where:

- a female avatar lives in the bottom-right corner
- the site asks for microphone access on entry
- the user can speak naturally
- the pipeline becomes:
  - microphone
  - STT
  - LLM
  - TTS
  - talking avatar
- the avatar should feel closer to `Simli` / `D-ID` product UX, not like a raw research demo

## What We Successfully Completed

### Site / frontend

- Reworked the site into a cleaner premium-looking landing page.
- Added a bottom-right avatar dock instead of a normal chat window.
- Added automatic microphone permission request on page load.
- Kept the dock always visible instead of hiding it behind a floating chat button.

### Chat / backend

- Switched chat from Groq to Gemini.
- Current intended chat provider:
  - `gemini-3-flash-preview`
- Kept STT on Groq.
- Added TTS support in the worker.

### TTS

- Tried Azure first, but portal onboarding and key retrieval were too slow and frustrating.
- Switched TTS to Yandex SpeechKit.
- Current working TTS choice:
  - provider: `yandex`
  - voice: `amira`
  - language: `kk-KZ`
- This was the fastest practical way to get a female Kazakh voice path into the worker.

### RunPod / avatar experiments

- Successfully launched RunPod pods on:
  - RTX 4090
  - RTX 5090
- Confirmed a key hardware fact:
  - RTX 5090 requires PyTorch `2.8+`
- Successfully launched `PersonaLive` on RTX 5090.
- Successfully exposed PersonaLive through Cloudflare tunnel.
- Successfully uploaded and animated the chosen female portrait in PersonaLive.

## Current True State

We do **not** yet have a complete autonomous talking-avatar pipeline on the site.

What we have:

- site UI
- Gemini chat
- Groq STT endpoint
- Yandex TTS endpoint
- a working external avatar demo path

What we do **not** yet have:

- a single controller that links all of them together
- persistent portrait control on our side
- autonomous avatar behavior like:
  - idle
  - listening
  - thinking
  - speaking
  - nodding / pausing appropriately

## Experiment Timeline

### 1. Ollama / Qwen on RunPod

We tried local LLM hosting first:

- installed Ollama
- pulled `qwen3.5:27b`
- verified it could respond

Why we rolled it back:

- it was not the actual bottleneck
- the main problem was avatar delivery, not LLM availability
- it consumed time, disk, and attention
- Groq / Gemini were simpler for product progress

Decision:

- stop using Ollama for this project path
- use hosted chat instead

### 2. FasterLivePortrait

We set up FasterLivePortrait on RunPod and got the web UI running.

What worked:

- repo installed
- checkpoints downloaded
- `onnxruntime-gpu` installed
- Kokoro TTS assets were added
- web UI launched on port `9870`

Why we rolled it back:

- the result behaved like a demo UI, not a clean site-ready avatar system
- the iframe approach brought in too much external interface
- it did not give us a stable, product-style talking-avatar experience

Decision:

- drop FasterLivePortrait as the main path

### 3. EchoMimicV3

We tried both `preview` and `flash`.

#### Preview

What happened:

- weights downloaded
- environment installed
- TensorFlow / RetinaFace path kept breaking

Main issue:

- `tensorflow.keras` and preview dependency conflicts
- too much environment pain for too little product progress

Decision:

- stop using preview

#### Flash

What happened:

- fixed missing `pyloudnorm`
- fixed wrong wav2vec source
- discovered `chinese-wav2vec2-base` must come from ModelScope, not Hugging Face
- got model loading much further

Main blocker:

- CUDA OOM on RTX 4090 with `infer_flash.py`

Important lesson:

- the README claims around `12G VRAM` for GradioUI
- our direct CLI path still loaded too much onto GPU
- formatting or reinstalling would not solve that

Decision:

- stop using EchoMimicV3 CLI on current hardware path
- do not keep grinding this as the main route

### 4. PersonaLive

This was the first avatar stack that clearly launched and visibly worked on RTX 5090.

What worked:

- Python 3.10 conda environment
- system PyTorch 2.8 on RTX 5090
- `--acceleration none`
- live camera-driven animation
- female portrait upload
- Cloudflare tunnel

Why it still was not the final answer:

- PersonaLive is fundamentally a `video-to-video` / `driving` system
- it expects camera or driving motion
- it does not behave like a built-in conversational avatar agent
- the site ended up embedding a full demo experience instead of a clean product widget

Critical product mismatch:

- it can animate well
- but it is not the right autonomous receptionist-avatar foundation for our UX target

Decision:

- keep PersonaLive as a useful experiment
- do not keep it as the final production path

## Main Mistakes / Where We Lost Time

### 1. Solving components in the wrong order

We spent time on model setup before locking the correct product architecture.

Better order would have been:

1. define final UX
2. choose the correct avatar orchestration model
3. then choose the rendering engine

### 2. Treating demo UIs as production APIs

We repeatedly embedded research/demo interfaces:

- FasterLivePortrait UI
- PersonaLive UI

That created:

- extra controls
- wrong framing
- missing persistence
- mismatch with our site UX

### 3. Not securing the voice stack in parallel early enough

Azure and Yandex TTS should have been finalized earlier while GPU experiments were running.

This caused avoidable delays.

### 4. Assuming “working avatar demo” equals “working autonomous agent”

It does not.

A working demo still needs:

- session orchestration
- behavior states
- portrait persistence
- speech synchronization

## Product / UX Lessons from Simli and D-ID

After reviewing their docs and behavior style, the important lesson is:

The magic is not only the face renderer.

The real product experience comes from a controller layer that manages:

- idle
- listening
- thinking
- speaking
- interruptions
- silence
- first greeting
- session timeout

This is why they feel polished.

That controller layer is what we still need.

## Why We Pivoted Toward LiveKit + MuseTalk

### LiveKit

What LiveKit is good for:

- realtime orchestration
- microphone / WebRTC / room logic
- agent session lifecycle

What LiveKit is **not**:

- not the face renderer itself

### MuseTalk

Why MuseTalk is the most sensible self-hosted next step:

- closer to realtime talking-face than the other self-hosted options we tested
- more aligned with a speaking-avatar use case than PersonaLive
- simpler product fit than EchoMimic / Hallo for our needs

### Final reasoning

If we do not want a paid provider like Simli or D-ID, then:

- we need our own controller
- we need a realtime session layer
- we need a talking-face renderer

Current best architecture:

- site UI: our own bottom-right dock
- session/control layer: LiveKit Agents
- chat: Gemini
- STT: Groq
- TTS: Yandex SpeechKit
- avatar renderer: MuseTalk

## What Is Working Right Now

- `apolloai.biz` frontend exists and is customizable
- Gemini path exists
- Groq STT endpoint exists in worker
- Yandex TTS endpoint exists in worker
- RunPod experimentation path is proven viable
- female portrait has already been selected and tested in live animation

## What Is Not Worth Repeating

Do not repeat these as primary paths:

- Ollama / local Qwen for this project
- FasterLivePortrait as main site avatar
- EchoMimicV3 preview
- EchoMimicV3 flash CLI on 4090
- PersonaLive as final autonomous avatar agent
- Azure onboarding for this specific project path

## Recommended Next Step

Build the next phase as a clean new subsystem:

1. keep current site
2. keep Gemini
3. keep Groq STT
4. keep Yandex TTS
5. stop using demo iframe logic as the final avatar product
6. build a proper controller around:
   - LiveKit Agents
   - MuseTalk
   - persistent female portrait

## One-Sentence Summary

We proved that the individual parts can work, but the project now needs a real avatar controller architecture instead of more attempts to force research demos into a production widget.
