#!/usr/bin/env bash
set -euo pipefail

cd /workspace/PersonaLive
source .venv/bin/activate
pip install -r requirements_trt.txt

printf '\nPersonaLive TensorRT dependencies installed.\n'
printf 'Next commands:\n'
printf '  cd /workspace/PersonaLive\n'
printf '  source .venv/bin/activate\n'
printf '  python torch2trt.py\n'
printf '  python inference_online.py --acceleration trt\n'
