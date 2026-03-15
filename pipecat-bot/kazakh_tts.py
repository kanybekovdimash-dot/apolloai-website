"""
KazakhTTS2 (ISSAI) — Pipecat TTS processor.

Uses ESPnet Tacotron2 (speaker F1) + ParallelWaveGAN vocoder.
Model files are expected at /app/models/kaztts_f1/ and /app/models/vocoder_f1/.
Runs on GPU for real-time inference.
"""

import io
import numpy as np
import soundfile as sf
import torch
from pipecat.frames.frames import AudioRawFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class KazakhTTS2Service(FrameProcessor):
    def __init__(
        self,
        *,
        model_dir: str = "/app/models/kaztts_f1",
        vocoder_dir: str = "/app/models/vocoder_f1",
        sample_rate: int = 22050,
        output_sample_rate: int = 48000,
        device: str = "cuda",
    ):
        super().__init__()
        self._model_dir = model_dir
        self._vocoder_dir = vocoder_dir
        self._sample_rate = sample_rate
        self._output_sample_rate = output_sample_rate
        self._device = device
        self._tts = None
        self._loaded = False

    def _load(self):
        if self._loaded:
            return

        from espnet2.bin.tts_inference import Text2Speech

        self._tts = Text2Speech.from_pretrained(
            model_file=f"{self._model_dir}/train.loss.ave_5best.pth",
            train_config=f"{self._model_dir}/config.yaml",
            vocoder_file=f"{self._vocoder_dir}/checkpoint-400000steps.pkl",
            vocoder_config=f"{self._vocoder_dir}/config.yml",
            device=self._device,
        )
        self._loaded = True
        print("[kaztts] KazakhTTS2 F1 model loaded")

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, TextFrame):
            await self.push_frame(frame, direction)
            return

        text = frame.text.strip()
        if not text:
            return

        self._load()

        with torch.no_grad():
            result = self._tts(text)

        wav = result["wav"].cpu().numpy()

        # Resample if needed (ESPnet outputs 22050, Pipecat/LiveKit expects 48000)
        if self._output_sample_rate != self._sample_rate:
            import librosa
            wav = librosa.resample(
                wav,
                orig_sr=self._sample_rate,
                target_sr=self._output_sample_rate,
            )

        # Normalize to int16 PCM
        wav = np.clip(wav, -1.0, 1.0)
        pcm = (wav * 32767).astype(np.int16)

        audio_frame = AudioRawFrame(
            audio=pcm.tobytes(),
            sample_rate=self._output_sample_rate,
            num_channels=1,
        )
        await self.push_frame(audio_frame, direction)
