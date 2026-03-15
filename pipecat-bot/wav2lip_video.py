import aiohttp
from pipecat.frames.frames import AudioRawFrame, ImageRawFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor


class Wav2LipVideoProcessor(FrameProcessor):
    def __init__(self, *, wav2lip_url: str, portrait_ready: bool = True):
        super().__init__()
        self._url = wav2lip_url.rstrip("/")
        self._portrait_ready = portrait_ready

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return

        # Forward audio frame downstream (for audio output)
        await self.push_frame(frame, direction)

        # Also send audio to Wav2Lip for video generation
        if not self._portrait_ready:
            return

        try:
            form = aiohttp.FormData()
            form.add_field("audio", frame.audio, content_type="audio/raw")

            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self._url}/inference", data=form) as resp:
                    if resp.status == 200:
                        image_bytes = await resp.read()
                        video_frame = ImageRawFrame(
                            image=image_bytes,
                            size=(96, 96),
                            format="JPEG",
                        )
                        await self.push_frame(video_frame, direction)
        except Exception:
            # Don't break audio pipeline if video fails
            pass
