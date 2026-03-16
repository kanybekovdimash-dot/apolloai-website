"""
Ditto video processor for Pipecat.
Sends audio frames to Ditto server, receives JPEG video frames.
"""

import logging
import aiohttp
from pipecat.frames.frames import AudioRawFrame, ImageRawFrame, Frame
from pipecat.processors.frame_processor import FrameProcessor

logger = logging.getLogger("ditto_video")


class DittoVideoProcessor(FrameProcessor):
    def __init__(self, *, ditto_url: str = "http://localhost:8000"):
        super().__init__()
        self._url = ditto_url.rstrip("/")
        self._audio_buffer = bytearray()
        self._sample_rate = 48000
        self._session = None
        # Buffer ~0.4s of audio before sending (Ditto online chunk size)
        self._chunk_bytes = int(0.4 * self._sample_rate * 2)  # 16-bit = 2 bytes per sample

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if not isinstance(frame, AudioRawFrame):
            await self.push_frame(frame, direction)
            return

        # Always forward audio downstream (for LiveKit audio output)
        await self.push_frame(frame, direction)

        # Buffer audio for Ditto
        self._audio_buffer.extend(frame.audio)

        if len(self._audio_buffer) < self._chunk_bytes:
            return

        # Send buffered audio to Ditto
        audio_chunk = bytes(self._audio_buffer)
        self._audio_buffer.clear()

        try:
            if self._session is None or self._session.closed:
                self._session = aiohttp.ClientSession()

            form = aiohttp.FormData()
            form.add_field("audio", audio_chunk, content_type="audio/raw")

            async with self._session.post(
                f"{self._url}/inference?sr={self._sample_rate}",
                data=form,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status != 200:
                    return

                # Parse multipart JPEG frames
                body = await resp.read()
                jpeg_frames = self._parse_multipart_frames(body)

                for jpeg_bytes in jpeg_frames:
                    video_frame = ImageRawFrame(
                        image=jpeg_bytes,
                        size=(512, 512),
                        format="JPEG",
                    )
                    await self.push_frame(video_frame, direction)
        except Exception as e:
            logger.warning("Ditto inference failed: %s", e)

    def _parse_multipart_frames(self, body: bytes) -> list:
        """Parse multipart/x-mixed-replace response into JPEG frames."""
        frames = []
        parts = body.split(b"--frame")
        for part in parts:
            start = part.find(b"\xff\xd8")
            if start >= 0:
                end = part.rfind(b"\xff\xd9")
                if end >= 0:
                    frames.append(part[start:end + 2])
        return frames
