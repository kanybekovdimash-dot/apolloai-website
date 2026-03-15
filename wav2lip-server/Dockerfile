FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y git ffmpeg libgl1-mesa-glx && \
    git clone https://github.com/Rudrabha/Wav2Lip.git /app/Wav2Lip && \
    rm -rf /app/Wav2Lip/.git

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "server.py"]
