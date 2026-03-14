#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-/workspace/ollama/models}"

apt-get update
apt-get install -y curl git git-lfs ca-certificates ffmpeg python3-pip build-essential
mkdir -p /workspace/ollama/models /workspace/logs

if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

pkill -f "ollama serve" || true
nohup ollama serve >/workspace/logs/ollama.log 2>&1 &

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

ollama pull qwen3:14b
curl -fsS http://127.0.0.1:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:14b","messages":[{"role":"user","content":"Salem, ozindi qysqa tanystyr."}],"stream":false}'