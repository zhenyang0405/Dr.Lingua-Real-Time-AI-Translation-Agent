from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from shared.auth import verify_token
import json
import logging
import base64
import asyncio
import time
import os
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
load_dotenv(dotenv_path=env_path)

from streaming.app.session_manager import create_session, create_run_config, runner
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

app = FastAPI(title="Dr. Lingua Streaming API")
logger = logging.getLogger("uvicorn.error")

# Enable debug logging for ADK and genai to see tool declarations sent to Gemini
logging.getLogger("google.adk").setLevel(logging.DEBUG)
logging.getLogger("google.genai").setLevel(logging.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://live-api-challenge--theta-citron-488903-i3.us-central1.hosted.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "dr-lingua-streaming"}


async def safe_send(websocket: WebSocket, data: dict, shutdown_event: asyncio.Event):
    """Send JSON to WebSocket, suppressing errors if shutdown is in progress."""
    if shutdown_event.is_set():
        return
    try:
        await websocket.send_json(data)
    except Exception:
        shutdown_event.set()


async def upstream_task(websocket: WebSocket, live_request_queue: LiveRequestQueue, shutdown_event: asyncio.Event, session_id: str):
    """Receive messages from browser and enqueue to LiveRequestQueue."""
    from streaming.app.active_documents import active_documents
    from streaming.app.latest_frames import latest_frames, FrameData

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message:
                data = json.loads(message["text"])
                msg_type = data.get("type")

                if msg_type == "audio":
                    # Decode base64 PCM audio and send as realtime input
                    audio_bytes = base64.b64decode(data["data"])
                    live_request_queue.send_realtime(
                        types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                    )

                elif msg_type == "screen_frame":
                    # Decode base64 JPEG frame and send as realtime input
                    frame_bytes = base64.b64decode(data["data"])
                    live_request_queue.send_realtime(
                        types.Blob(data=frame_bytes, mime_type="image/jpeg")
                    )

                elif msg_type == "document_frame":
                    # Decode base64 JPEG document page and send as realtime input
                    frame_bytes = base64.b64decode(data["data"])
                    latest_frames[session_id] = FrameData(
                        image=frame_bytes,
                        selection=data.get("selection"),
                    )
                    live_request_queue.send_realtime(
                        types.Blob(data=frame_bytes, mime_type="image/jpeg")
                    )

                elif msg_type == "text":
                    # Send text as content (not realtime)
                    live_request_queue.send_content(
                        types.Content(
                            role="user",
                            parts=[types.Part(text=data["content"])]
                        )
                    )

                elif msg_type == "set_document":
                    active_documents[session_id] = data["doc_name"]
                    logger.info(f"[upstream] Active document set: {data['doc_name']} for session {session_id}")

    except WebSocketDisconnect:
        logger.info("Upstream task: WebSocket disconnected")
    except Exception as e:
        logger.error(f"Upstream error: {e}")
    finally:
        shutdown_event.set()
        live_request_queue.close()
        active_documents.pop(session_id, None)
        latest_frames.pop(session_id, None)

async def downstream_task(websocket: WebSocket, runner, user_id: str, session_id: str, live_request_queue: LiveRequestQueue, run_config, shutdown_event: asyncio.Event):
    """Process events from run_live() and send to browser.

    Automatically reconnects when the Gemini Live API drops the connection.
    """
    max_retries = 5
    retry_count = 0

    while retry_count < max_retries and not shutdown_event.is_set():
        try:
            logger.info(f"[downstream] Starting run_live for user={user_id}, session={session_id}")
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if shutdown_event.is_set():
                    return

                # Log every event for debugging
                logger.debug(f"[downstream] Event: turn_complete={event.turn_complete}, "
                             f"interrupted={event.interrupted}, "
                             f"has_content={bool(event.content and event.content.parts)}, "
                             f"has_input_tx={bool(event.input_transcription)}, "
                             f"has_output_tx={bool(event.output_transcription)}")

                # Handle content parts (audio output + tool calls)
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.inline_data:
                            audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                            await safe_send(websocket, {
                                "type": "audio",
                                "data": audio_b64
                            }, shutdown_event)
                        if part.function_call:
                            logger.info(f"[downstream] Tool call: name={part.function_call.name}, "
                                        f"args={part.function_call.args}")
                            await safe_send(websocket, {
                                "type": "tool_call",
                                "name": part.function_call.name,
                                "args": part.function_call.args
                            }, shutdown_event)
                        if part.function_response:
                            logger.info(f"[downstream] Tool response: name={part.function_response.name}, "
                                        f"response={part.function_response.response}")

                # Handle transcription events
                if event.input_transcription and event.input_transcription.text:
                    await safe_send(websocket, {
                        "type": "transcription",
                        "role": "user",
                        "text": event.input_transcription.text
                    }, shutdown_event)
                if event.output_transcription and event.output_transcription.text:
                    await safe_send(websocket, {
                        "type": "transcription",
                        "role": "agent",
                        "text": event.output_transcription.text
                    }, shutdown_event)

                # Handle turn completion
                if event.turn_complete:
                    await safe_send(websocket, {"type": "turn_complete"}, shutdown_event)

                # Handle interruption
                if event.interrupted:
                    await safe_send(websocket, {"type": "interrupted"}, shutdown_event)

            # run_live() ended normally (iterator exhausted)
            break

        except WebSocketDisconnect:
            logger.info("Downstream task: WebSocket disconnected")
            return
        except Exception as e:
            retry_count += 1
            logger.warning(f"Gemini connection dropped (attempt {retry_count}/{max_retries}): {e}", exc_info=True)
            if retry_count >= max_retries:
                logger.error(f"Downstream giving up after {max_retries} retries")
                await safe_send(websocket, {"type": "error", "message": "Gemini connection lost"}, shutdown_event)
                return
            # Brief pause before reconnecting
            await asyncio.sleep(1)
            logger.info(f"Reconnecting to Gemini Live API (attempt {retry_count})...")
            await safe_send(websocket, {"type": "reconnecting"}, shutdown_event)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Phase 1: Auth
    try:
        first_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
    except WebSocketDisconnect:
        logger.info("Client disconnected before sending auth (likely React StrictMode)")
        return
    except asyncio.TimeoutError:
        logger.error("Auth timeout")
        await websocket.close(code=4001, reason="Auth timeout")
        return

    if first_msg.get("type") != "auth":
        logger.error("First message must be auth")
        await websocket.close(code=4001, reason="First message must be auth")
        return

    try:
        # shared module is imported so verify_token is accessible
        uid = await verify_token(first_msg["token"])
    except ValueError as e:
        logger.error(f"Token verification failed: {e}")
        await websocket.close(code=4003, reason="Invalid token")
        return

    # Phase 2: Session Init
    session_id = f"session_{uid}_{int(time.time())}"

    await websocket.send_json({"type": "auth_success", "uid": uid, "session_id": session_id})

    try:
        logger.info(f"[ws] Creating ADK session for user={uid}, session={session_id}")
        await create_session(user_id=uid, session_id=session_id)
        live_request_queue = LiveRequestQueue()
        run_config = create_run_config()
        logger.info(f"[ws] Session created successfully, run_config={run_config}")
    except Exception as e:
        logger.error(f"Failed to create session: {e}", exc_info=True)
        await websocket.close(code=1011, reason="Session Init Error")
        return

    # Phase 3: Streaming Loop
    logger.info(f"[ws] Starting streaming loop for user={uid}, session={session_id}")
    shutdown_event = asyncio.Event()
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(upstream_task(websocket, live_request_queue, shutdown_event, session_id))
            tg.create_task(downstream_task(websocket, runner, uid, session_id, live_request_queue, run_config, shutdown_event))
    except* WebSocketDisconnect:
        logger.info(f"Client {uid} disconnected")
    except* Exception as e:
        logger.error(f"Session error for {uid}: {e}", exc_info=True)
    finally:
        # Phase 4: Cleanup — ALWAYS close the queue
        shutdown_event.set()
        live_request_queue.close()
