#!/usr/bin/env bash
set -euo pipefail

export OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-/workspace/ollama/models}"

mkdir -p "$OLLAMA_MODELS"
mkdir -p /workspace/logs

if ! command -v ollama >/dev/null 2>&1; then
  echo "[1/5] Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "[1/5] Ollama already installed."
fi

echo "[2/5] Starting Ollama server on ${OLLAMA_HOST}..."
pkill -f "ollama serve" || true
nohup ollama serve >/workspace/logs/ollama.log 2>&1 &

echo "[3/5] Waiting for Ollama API..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[4/5] Pulling qwen3:14b..."
ollama pull qwen3:14b

echo "[5/5] Running smoke test..."
curl -fsS http://127.0.0.1:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:14b","messages":[{"role":"user","content":"Salem, ozindi qysqa tanystyr."}],"stream":false}'

echo
echo "Ollama is ready."
echo "Public RunPod proxy should later point to port 11434."
echo "Log file: /workspace/logs/ollama.log"