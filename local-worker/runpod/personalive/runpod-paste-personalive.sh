#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export NVM_DIR="$HOME/.nvm"

apt-get update
apt-get install -y \
  curl \
  git \
  git-lfs \
  ffmpeg \
  ca-certificates \
  build-essential \
  python3-pip \
  python3.11-venv \
  cmake \
  pkg-config \
  libgl1 \
  libglib2.0-0

cd /workspace
if [ ! -d PersonaLive ]; then
  git clone https://github.com/GVCLab/PersonaLive.git
fi

cd /workspace/PersonaLive
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip setuptools wheel
pip install -r requirements_base.txt

if ! command -v node >/dev/null 2>&1; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  . "$NVM_DIR/nvm.sh"
  nvm install 18
  nvm alias default 18
fi

echo "PersonaLive base is ready."
echo "Next:"
echo "  cd /workspace/PersonaLive"
echo "  source .venv/bin/activate"
echo "  python inference_online.py --acceleration none"
