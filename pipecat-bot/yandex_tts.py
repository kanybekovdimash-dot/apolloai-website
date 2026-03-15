import aiohttp
from pipecat.frames.frames import AudioRawFrame, TextFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class YandexTTSService(FrameProcessor):
    def __init__(self, *, api_key: str, voice: str = "amira", lang: str = "kk-KZ", speed: str = "1.0", sample_rate: int = 48000):
        super().__init__()
        self._api_key = api_key
        self._voice = voice
        self._lang = lang
        self._speed = speed
        self._sample_rate = sample_rate
        self._url = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"

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

        headers = {
            "Authorization": f"Api-Key {self._api_key}",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(self._url, data=params, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise RuntimeError(f"Yandex TTS failed: {error}")
                audio_bytes = await resp.read()

        audio_frame = AudioRawFrame(
            audio=audio_bytes,
            sample_rate=self._sample_rate,
            num_channels=1,
        )
        await self.push_frame(audio_frame, direction)
