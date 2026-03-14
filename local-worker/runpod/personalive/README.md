PersonaLive on RunPod 5090

This folder is local-only. It is not pushed to GitHub.

Recommended pod
- GPU: RTX 5090
- Template: PyTorch 2.8+ image
- Jupyter notebook: on
- SSH terminal access: off
- Pricing: On-Demand
- Container Disk: 60-80 GB
- Volume Disk: 100 GB or more

Why 5090
- PersonaLive docs mention RTX 50-Series should start with `--acceleration none`.
- The public TensorRT engines are built on H100. For 5090, first verify the plain online path, then build TRT locally on the same pod.

Fast path
1. Open a RunPod terminal.
2. Run:

```bash
bash /workspace/runpod/personalive/bootstrap-personalive-base.sh
```

3. Then run:

```bash
cd /workspace/PersonaLive
source .venv/bin/activate
python inference_online.py --acceleration none
```

4. Open the UI at `http://127.0.0.1:7860`.

Public demo tunnel
```bash
cloudflared tunnel --url http://127.0.0.1:7860
```

Optional TensorRT path on 5090
1. Keep the same pod.
2. Run:

```bash
bash /workspace/runpod/personalive/bootstrap-personalive-trt.sh
```

3. Build local TRT engines on the 5090.
4. Then rerun:

```bash
cd /workspace/PersonaLive
source .venv/bin/activate
python inference_online.py --acceleration trt
```

Notes
- Start with `--acceleration none` first. It is the safest path for RTX 50-Series.
- Only switch to `trt` after the plain online demo is alive.
- Groq remains the brain. PersonaLive is only the avatar engine.
