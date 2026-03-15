import os
import asyncio
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def watch_rooms():
    lk = api.LiveKitAPI(
        url=os.getenv("LIVEKIT_URL", "").replace("ws://", "http://").replace("wss://", "https://"),
        api_key=os.getenv("LIVEKIT_KEY"),
        api_secret=os.getenv("LIVEKIT_SECRET"),
    )

    active_bots = {}

    while True:
        try:
            rooms_response = await lk.room.list_rooms(api.ListRoomsRequest())
            rooms = rooms_response.rooms

            for room in rooms:
                if room.name.startswith("avatar-") and room.name not in active_bots:
                    participants_response = await lk.room.list_participants(
                        api.ListParticipantsRequest(room=room.name)
                    )
                    has_user = any(
                        not p.identity.startswith("bot-")
                        for p in participants_response.participants
                    )

                    if has_user:
                        print(f"Spawning bot for room: {room.name}")
                        proc = await asyncio.create_subprocess_exec(
                            "python", "bot.py", room.name,
                            cwd=os.path.dirname(os.path.abspath(__file__)),
                        )
                        active_bots[room.name] = proc

            # Clean up finished bots
            for room_name in list(active_bots):
                proc = active_bots[room_name]
                if proc.returncode is not None:
                    del active_bots[room_name]

        except Exception as e:
            print(f"Room watcher error: {e}")

        await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(watch_rooms())
