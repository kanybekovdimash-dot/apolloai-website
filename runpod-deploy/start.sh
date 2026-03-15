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
