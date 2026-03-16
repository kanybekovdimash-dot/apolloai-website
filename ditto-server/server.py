"""
Ditto talking head inference server.
Accepts audio PCM → returns JPEG video frames (512x512).
Runs on :8000.
"""

import os
import math
import threading
import numpy as np
import cv2
import librosa
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

SDK = None
_inference_lock = threading.Lock()
PORTRAIT_PATH = os.getenv("PORTRAIT_PATH", "/app/ditto-server/portrait.png")
DITTO_DATA_ROOT = os.getenv("DITTO_DATA_ROOT", "/app/checkpoints/ditto_trt_Ampere_Plus")
DITTO_CFG_PKL = os.getenv("DITTO_CFG_PKL", "/app/checkpoints/ditto_cfg/v0.4_hubert_cfg_trt_online.pkl")


def load_model():
    global SDK
    import sys
    sys.path.insert(0, "/app/ditto-talkinghead")
    from stream_pipeline_online import StreamSDK

    SDK = StreamSDK(
        cfg_pkl=DITTO_CFG_PKL,
        data_root=DITTO_DATA_ROOT,
    )
    SDK.setup(
        source_path=PORTRAIT_PATH,
        output_path="/tmp/ditto_placeholder.mp4",
        online_mode=True,
        max_size=512,
    )
    print("[ditto] Model loaded, portrait registered")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model_loaded": SDK is not None})


@app.route("/inference", methods=["POST"])
def inference():
    """
    Accepts: raw PCM audio (16kHz mono int16) as binary body or file upload.
    Returns: multipart JPEG frames.
    """
    if SDK is None:
        return jsonify({"ok": False, "error": "Model not loaded"}), 503

    audio_file = request.files.get("audio")
    if audio_file:
        audio_bytes = audio_file.read()
    else:
        audio_bytes = request.get_data()

    if not audio_bytes:
        return jsonify({"ok": False, "error": "No audio provided"}), 400

    # Convert PCM int16 to float32
    audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
    audio_float = audio_int16.astype(np.float32) / 32768.0

    # Ditto expects 16kHz — resample if needed
    sample_rate = int(request.args.get("sr", 48000))
    if sample_rate != 16000:
        audio_float = librosa.resample(audio_float, orig_sr=sample_rate, target_sr=16000)

    num_frames = math.ceil(len(audio_float) / 16000 * 25)
    if num_frames == 0:
        return jsonify({"ok": False, "error": "Audio too short"}), 400

    chunksize = (3, 5, 2)
    chunk_samples = chunksize[1] * 640

    frames = []
    with _inference_lock:
        SDK.setup_Nd(N_d=num_frames)

        for i in range(0, len(audio_float), chunk_samples):
            chunk = audio_float[i:i + chunk_samples]
            if len(chunk) < chunk_samples:
                chunk = np.pad(chunk, (0, chunk_samples - len(chunk)))
            result_frames = SDK.run_chunk(chunk, chunksize)
            if result_frames:
                for f in result_frames:
                    _, buffer = cv2.imencode(".jpg", cv2.cvtColor(f, cv2.COLOR_RGB2BGR),
                                              [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frames.append(buffer.tobytes())

    if not frames:
        return jsonify({"ok": False, "error": "No frames generated"}), 500

    def generate():
        for frame_bytes in frames:
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n"
                   b"Content-Length: " + str(len(frame_bytes)).encode() + b"\r\n\r\n"
                   + frame_bytes + b"\r\n")
        yield b"--frame--\r\n"

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    print("[ditto] Loading model...")
    load_model()
    print("[ditto] Server ready on :8000")
    app.run(host="0.0.0.0", port=8000)
