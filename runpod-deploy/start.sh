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
    if ! kill -0 $DITTO_PID 2>/dev/null; then
        echo "       ERROR: Ditto process died during startup"
        exit 1
    fi
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
