"""
Yandex SpeechKit TTS — Pipecat processor.
Voice: Жанар (Kazakh). Returns raw PCM audio frames.
"""

import os
import aiohttp
from pipecat.frames.frames import AudioRawFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class YandexTTSService(FrameProcessor):
    def __init__(
        self,
        *,
        api_key: str = None,
        voice: str = "zhanar",
        lang: str = "kk-KZ",
        speed: str = "1.0",
        sample_rate: int = 48000,
    ):
        super().__init__()
        self._api_key = api_key or os.getenv("YANDEX_API_KEY")
        self._voice = voice
        self._lang = lang
        self._speed = speed
        self._sample_rate = sample_rate
        self._url = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
        self._session = None

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, TextFrame):
            await self.push_frame(frame, direction)
            return

        text = frame.text.strip()
        if not text:
            return

        params = {
            "text": text,
            "lang": self._lang,
            "voice": self._voice,
            "format": "lpcm",
            "sampleRateHertz": str(self._sample_rate),
            "speed": self._speed,
        }

        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()

        async with self._session.post(
            self._url,
            headers={
                "Authorization": f"Api-Key {self._api_key}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data=params,
        ) as resp:
            if resp.status != 200:
                error = await resp.text()
                print(f"[yandex-tts] Error: {error}")
                return

            audio_bytes = await resp.read()

        # Chunk audio into ~0.4s segments for streaming to Ditto
        chunk_size = int(self._sample_rate * 0.4) * 2  # 16-bit = 2 bytes per sample
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            audio_frame = AudioRawFrame(
                audio=chunk,
                sample_rate=self._sample_rate,
                num_channels=1,
            )
            await self.push_frame(audio_frame, direction)
