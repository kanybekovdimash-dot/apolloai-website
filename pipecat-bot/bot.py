import os
import sys
import asyncio
from dotenv import load_dotenv

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.transports.services.livekit import LiveKitTransport, LiveKitParams
from pipecat.services.groq import GroqSTTService
from pipecat.services.google import GoogleLLMService

load_dotenv()

SYSTEM_PROMPT = (
    "You are the casting assistant for Meyram Cinema. "
    "Primary language is Kazakh. If the user writes in Russian, respond in Russian. "
    "Use natural, simple, conversational Kazakh. Keep grammar clean. "
    "Keep answers short, warm, and practical. Usually 1-3 short sentences. "
    "Your goal is to help parents register children for casting."
)


async def run_bot(room_name: str):
    transport = LiveKitTransport(
        url=os.getenv("LIVEKIT_URL"),
        api_key=os.getenv("LIVEKIT_KEY"),
        api_secret=os.getenv("LIVEKIT_SECRET"),
        room_name=room_name,
        participant_name="bot-avatar",
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_enabled=True,
        ),
    )

    stt = GroqSTTService(
        api_key=os.getenv("GROQ_API_KEY"),
        model="whisper-large-v3",
        language="kk",
    )

    llm = GoogleLLMService(
        api_key=os.getenv("GEMINI_API_KEY"),
        model="gemini-2.0-flash",
        system_instruction=SYSTEM_PROMPT,
    )

    # TTS: Yandex SpeechKit — added in Task 7 (yandex_tts.py)
    # For now pipeline is STT → LLM only (no voice output yet)

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
    )

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    room = sys.argv[1] if len(sys.argv) > 1 else "avatar-test"
    asyncio.run(run_bot(room))
