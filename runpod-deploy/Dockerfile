###############################################################################
# RunPod unified image: Pipecat + Yandex TTS + Ditto Talking Head
# GPU: RTX 3090 (24GB VRAM) — ~$0.22/hr on RunPod
# All services on one pod = 0ms inter-service latency
###############################################################################
FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

WORKDIR /app

# ── system deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libsndfile1 libgl1-mesa-glx curl && \
    rm -rf /var/lib/apt/lists/*

# ── Ditto source ─────────────────────────────────────────────────────────────
RUN git clone https://github.com/antgroup/ditto-talkinghead.git /app/ditto-talkinghead && \
    rm -rf /app/ditto-talkinghead/.git

# ── Ditto model weights (HuggingFace) ────────────────────────────────────────
RUN pip install --no-cache-dir huggingface_hub && \
    python -c "from huggingface_hub import snapshot_download; snapshot_download('digital-avatar/ditto-talkinghead', local_dir='/app/checkpoints')"

# ── Python deps ──────────────────────────────────────────────────────────────
COPY runpod-deploy/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Ditto deps ───────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir \
    tensorrt==8.6.1 librosa tqdm filetype imageio opencv-python-headless \
    scikit-image cython cuda-python imageio-ffmpeg polygraphy "numpy==2.0.1"

# ── Copy application code ───────────────────────────────────────────────────
# Build with: docker build -f runpod-deploy/Dockerfile .  (from repo root)
COPY pipecat-bot /app/pipecat-bot
COPY ditto-server /app/ditto-server
COPY runpod-deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# ── Portrait image ───────────────────────────────────────────────────────────
# Place your avatar portrait as portrait.png in ditto-server/
# Or mount at runtime: -v /path/to/portrait.png:/app/ditto-server/portrait.png

ENV DITTO_DATA_ROOT=/app/checkpoints/ditto_trt_Ampere_Plus
ENV DITTO_CFG_PKL=/app/checkpoints/ditto_cfg/v0.4_hubert_cfg_trt_online.pkl
ENV DITTO_URL=http://localhost:8000
ENV PORTRAIT_PATH=/app/ditto-server/portrait.png

EXPOSE 8000

CMD ["/app/start.sh"]
