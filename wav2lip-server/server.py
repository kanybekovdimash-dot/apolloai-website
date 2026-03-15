import os
import io
import cv2
import numpy as np
import torch
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

model = None
face_image = None

PORTRAIT_PATH = os.getenv("PORTRAIT_PATH", "portrait.jpg")
MODEL_PATH = os.getenv("WAV2LIP_MODEL_PATH", "checkpoints/wav2lip_gan.pth")


def load_model():
    global model
    import sys
    sys.path.insert(0, "/app/Wav2Lip")
    from models import Wav2Lip as Wav2LipModel
    model = Wav2LipModel()
    checkpoint = torch.load(MODEL_PATH, map_location="cuda")
    s = checkpoint["state_dict"]
    new_s = {k.replace("module.", ""): v for k, v in s.items()}
    model.load_state_dict(new_s)
    model = model.cuda().eval()
    return model


def load_face():
    global face_image
    img = cv2.imread(PORTRAIT_PATH)
    if img is None:
        raise FileNotFoundError(f"Portrait not found: {PORTRAIT_PATH}")
    face_image = cv2.resize(img, (96, 96))
    return face_image


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model_loaded": model is not None})


@app.route("/inference", methods=["POST"])
def inference():
    """
    Accepts: audio chunk (PCM or WAV) as file upload
    Returns: lip-synced video frames as MJPEG

    Note: This is a scaffold. Full Wav2Lip integration requires:
    1. Audio -> mel spectrogram conversion
    2. Face detection + crop from portrait
    3. Wav2Lip forward pass per audio chunk
    4. Frame encoding and streaming
    Full implementation will be done during RunPod deployment.
    """
    if model is None or face_image is None:
        return jsonify({"ok": False, "error": "Model not loaded"}), 503

    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"ok": False, "error": "Audio file required"}), 400

    _, buffer = cv2.imencode(".jpg", face_image)
    return send_file(
        io.BytesIO(buffer.tobytes()),
        mimetype="image/jpeg"
    )


if __name__ == "__main__":
    print("Loading Wav2Lip model...")
    load_model()
    print("Loading portrait...")
    load_face()
    print("Server ready")
    app.run(host="0.0.0.0", port=8000)
