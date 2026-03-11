import asyncio
import base64
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from tanjiro_agent import root_agent

APP_NAME = "tanjiro-live"

session_service = InMemorySessionService()
runner = Runner(
    app_name=APP_NAME,
    agent=root_agent,
    session_service=session_service,
)

app = FastAPI(title="Tanjiro Live Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    await websocket.accept()

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=[types.Modality.AUDIO],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        session_resumption=types.SessionResumptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
            )
        ),
    )

    live_request_queue = LiveRequestQueue()

    async def send_json(data: dict):
        await websocket.send_text(json.dumps(data))

    try:

        async def upstream_task():
            try:
                async for message in websocket.iter_text():
                    try:
                        data = json.loads(message)
                    except json.JSONDecodeError:
                        continue

                    if "audio" in data:
                        audio_data = base64.b64decode(data["audio"])
                        blob = types.Blob(
                            mime_type="audio/pcm;rate=16000", data=audio_data
                        )
                        live_request_queue.send_realtime(blob)
                    elif "text" in data:
                        content = types.Content(
                            parts=[types.Part(text=data["text"])],
                            role="user",
                        )
                        live_request_queue.send_content(content)
                    elif data.get("type") == "interrupt" or data.get("type") == "stop":
                        # Sending an activity start signal tells the agent the user has started doing something, which cancels its current playback.
                        print("Backend received interrupt from frontend!")
                        live_request_queue.send_activity_start()
                        live_request_queue.send_activity_end()
            except WebSocketDisconnect:
                pass

        async def downstream_task():
            is_first_audio_in_turn = True

            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.inline_data:
                            if is_first_audio_in_turn:
                                await send_json(
                                    {"type": "state", "state": "talking"}
                                )
                                is_first_audio_in_turn = False

                            audio_b64 = base64.b64encode(
                                part.inline_data.data
                            ).decode("utf-8")
                            await send_json({"type": "audio", "data": audio_b64})

                if event.output_transcription and event.output_transcription.text:
                    if not event.output_transcription.finished:
                        await send_json({"type": "text", "data": event.output_transcription.text})

                if event.turn_complete:
                    await send_json({"type": "turn_complete"})
                    await send_json({"type": "state", "state": "blink"})
                    is_first_audio_in_turn = True

                if event.interrupted:
                    await send_json({"type": "interrupted"})
                    await send_json({"type": "state", "state": "blink"})
                    is_first_audio_in_turn = True
                    

        await asyncio.gather(upstream_task(), downstream_task())

    finally:
        live_request_queue.close()
