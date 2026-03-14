#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "[1/4] Updating apt packages..."
apt-get update

echo "[2/4] Installing base dependencies..."
apt-get install -y \
  curl \
  git \
  git-lfs \
  ca-certificates \
  ffmpeg \
  python3-pip \
  build-essential

echo "[3/4] Preparing workspace folders..."
mkdir -p /workspace/runpod
mkdir -p /workspace/ollama/models
mkdir -p /workspace/logs

echo "[4/4] Base bootstrap complete."
echo "Next: bash /workspace/runpod/bootstrap-ollama-qwen.sh"