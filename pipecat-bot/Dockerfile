FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# System deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libsndfile1 curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download KazakhTTS2 F1 model + vocoder
RUN mkdir -p /app/models/kaztts_f1 /app/models/vocoder_f1

# Model F1 (Tacotron2)
RUN curl -L -o /tmp/kaztts_f1.zip \
    "https://issai.nu.edu.kz/wp-content/uploads/2022/03/kaztts_female1_tacotron2_train.loss.ave.zip" && \
    cd /app/models/kaztts_f1 && unzip /tmp/kaztts_f1.zip && rm /tmp/kaztts_f1.zip

# Vocoder F1 (ParallelWaveGAN)
RUN curl -L -o /tmp/vocoder_f1.zip \
    "https://issai.nu.edu.kz/wp-content/uploads/2022/03/parallelwavegan_female1_checkpoint.zip" && \
    cd /app/models/vocoder_f1 && unzip /tmp/vocoder_f1.zip && rm /tmp/vocoder_f1.zip

COPY . .

CMD ["python", "room_watcher.py"]
