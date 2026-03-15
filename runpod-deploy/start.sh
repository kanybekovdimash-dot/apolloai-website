#!/bin/bash
set -e

echo "============================================"
echo " Meyram Cinema Avatar — RunPod Startup"
echo " KazakhTTS2 (F1) + Wav2Lip + Pipecat"
echo "============================================"

# ── 1. Start Wav2Lip server ─────────────────────────────────────────────────
echo "[1/3] Starting Wav2Lip server on :8000..."
cd /app/wav2lip-server
python server.py &
WAV2LIP_PID=$!

echo "[2/3] Waiting for Wav2Lip model to load..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:8000/health | grep -q '"ok": true'; then
        echo "       Wav2Lip ready (took ~${i}s)"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "       WARNING: Wav2Lip health check timed out, continuing anyway..."
    fi
    sleep 1
done

# ── 2. Start Pipecat bot (room watcher) ─────────────────────────────────────
echo "[3/3] Starting Pipecat room watcher..."
cd /app/pipecat-bot
export WAV2LIP_URL=http://localhost:8000
export KAZTTS_MODEL_DIR=/app/models/kaztts_f1
export KAZTTS_VOCODER_DIR=/app/models/vocoder_f1
python room_watcher.py &
PIPECAT_PID=$!

echo "============================================"
echo " All services running!"
echo "   Wav2Lip PID=$WAV2LIP_PID"
echo "   Pipecat PID=$PIPECAT_PID"
echo ""
echo " Stack:"
echo "   STT:  Groq Whisper (cloud)"
echo "   LLM:  Google Gemini 2.0 Flash (cloud)"
echo "   TTS:  KazakhTTS2 F1 — local GPU"
echo "   VAD:  Silero — local (stop_secs=0.4)"
echo "   Video: Wav2Lip — local GPU"
echo "============================================"

# Keep container alive
wait
