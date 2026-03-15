###############################################################################
# RunPod unified image: Pipecat + KazakhTTS2 (F1) + Wav2Lip
# GPU: NVIDIA T4 (16GB VRAM) — ~$0.20/hr on RunPod
# All services on one pod = 0ms inter-service latency
###############################################################################
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# ── system deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libsndfile1 libgl1-mesa-glx curl unzip && \
    rm -rf /var/lib/apt/lists/*

# ── Wav2Lip source ──────────────────────────────────────────────────────────
RUN git clone https://github.com/Rudrabha/Wav2Lip.git /app/Wav2Lip && \
    rm -rf /app/Wav2Lip/.git

# ── Python deps (combined) ──────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Download KazakhTTS2 F1 model ────────────────────────────────────────────
RUN mkdir -p /app/models/kaztts_f1 /app/models/vocoder_f1

RUN curl -L -o /tmp/kaztts_f1.zip \
    "https://issai.nu.edu.kz/wp-content/uploads/2022/03/kaztts_female1_tacotron2_train.loss.ave.zip" && \
    cd /app/models/kaztts_f1 && unzip /tmp/kaztts_f1.zip && rm /tmp/kaztts_f1.zip

RUN curl -L -o /tmp/vocoder_f1.zip \
    "https://issai.nu.edu.kz/wp-content/uploads/2022/03/parallelwavegan_female1_checkpoint.zip" && \
    cd /app/models/vocoder_f1 && unzip /tmp/vocoder_f1.zip && rm /tmp/vocoder_f1.zip

# ── Download Wav2Lip GAN model ──────────────────────────────────────────────
RUN mkdir -p /app/Wav2Lip/checkpoints && \
    echo ">> Wav2Lip GAN checkpoint must be placed at /app/Wav2Lip/checkpoints/wav2lip_gan.pth" && \
    echo ">> Download from: https://github.com/Rudrabha/Wav2Lip#getting-the-weights"

# ── Copy application code ───────────────────────────────────────────────────
COPY ../pipecat-bot /app/pipecat-bot
COPY ../wav2lip-server /app/wav2lip-server
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# ── Portrait image (mount or bake in) ───────────────────────────────────────
# Place your avatar portrait as portrait.jpg in wav2lip-server/
# Or mount at runtime: -v /path/to/portrait.jpg:/app/wav2lip-server/portrait.jpg

ENV KAZTTS_MODEL_DIR=/app/models/kaztts_f1
ENV KAZTTS_VOCODER_DIR=/app/models/vocoder_f1
ENV WAV2LIP_MODEL_PATH=/app/Wav2Lip/checkpoints/wav2lip_gan.pth
ENV WAV2LIP_URL=http://localhost:8000
ENV PORTRAIT_PATH=/app/wav2lip-server/portrait.jpg

EXPOSE 8000

CMD ["/app/start.sh"]
