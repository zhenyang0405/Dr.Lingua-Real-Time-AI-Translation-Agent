from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from shared.auth import verify_token
from shared.firestore_client import save_conversation
import json
import logging
import base64
import asyncio
import time
import os
import re
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
load_dotenv(dotenv_path=env_path)

from visual_noun.app.session_manager import create_session, create_run_config, runner
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

app = FastAPI(title="Dr. Lingua Visual Noun API")
logger = logging.getLogger("uvicorn.error")

logging.getLogger("google.adk").setLevel(logging.DEBUG)
logging.getLogger("google.genai").setLevel(logging.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://live-api-challenge--theta-citron-488903-i3.us-central1.hosted.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def detect_language(text: str) -> str:
    """Detect whether text is Japanese or English."""
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
        return "JP"
    if re.search(r'[\u4e00-\u9fff]', text):
        return "JP"
    return "EN"


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "dr-lingua-visual-noun"}


async def safe_send(websocket: WebSocket, data: dict, shutdown_event: asyncio.Event):
    """Send JSON to WebSocket, suppressing errors if shutdown is in progress."""
    if shutdown_event.is_set():
        return
    try:
        await websocket.send_json(data)
    except Exception:
        shutdown_event.set()


async def upstream_task(websocket: WebSocket, live_request_queue: LiveRequestQueue, shutdown_event: asyncio.Event):
    """Receive messages from browser and enqueue to LiveRequestQueue.

    Simplified compared to streaming service: only handles audio and text (no documents/frames).
    """
    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message:
                data = json.loads(message["text"])
                msg_type = data.get("type")

                if msg_type == "audio":
                    audio_bytes = base64.b64decode(data["data"])
                    live_request_queue.send_realtime(
                        types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                    )

                elif msg_type == "text":
                    live_request_queue.send_content(
                        types.Content(
                            role="user",
                            parts=[types.Part(text=data["content"])]
                        )
                    )

    except WebSocketDisconnect:
        logger.info("Upstream task: WebSocket disconnected")
    except Exception as e:
        logger.error(f"Upstream error: {e}")
    finally:
        shutdown_event.set()
        live_request_queue.close()


def _flush_turn(input_buf: dict, output_buf: dict, pending_cards: list, conversation_turns: list):
    """Build a paired turn dict from buffers and append to conversation_turns."""
    input_text = input_buf["text"].strip()
    output_text = output_buf["text"].strip()
    if not input_text and not output_text:
        return

    turn = {}
    if input_text:
        turn["input"] = {
            "role": "user",
            "language": input_buf["language"],
            "text": input_text,
            "timestamp": int(time.time() * 1000),
        }
    if output_text:
        output_entry = {
            "role": "agent",
            "language": output_buf["language"],
            "text": output_text,
            "timestamp": int(time.time() * 1000),
        }
        if pending_cards:
            output_entry["cards"] = list(pending_cards)
        turn["output"] = output_entry

    conversation_turns.append(turn)

    # Reset buffers
    input_buf["text"] = ""
    input_buf["language"] = ""
    output_buf["text"] = ""
    output_buf["language"] = ""
    pending_cards.clear()


async def downstream_task(websocket: WebSocket, runner, user_id: str, session_id: str, live_request_queue: LiveRequestQueue, run_config, shutdown_event: asyncio.Event, conversation_turns: list):
    """Process events from run_live() and send to browser.

    Handles audio, transcriptions, tool calls, and visual noun card responses.
    Buffers transcriptions and saves paired turns to Firestore.
    """
    max_retries = 5
    retry_count = 0

    # Backend-side transcript buffers (mirrors frontend pattern)
    input_buf = {"text": "", "language": "EN"}
    output_buf = {"text": "", "language": "JP"}
    pending_cards: list[dict] = []

    while retry_count < max_retries and not shutdown_event.is_set():
        try:
            last_input_language = "EN"
            logger.info(f"[downstream] Starting run_live for user={user_id}, session={session_id}")
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if shutdown_event.is_set():
                    return

                # Handle content parts (audio output + tool calls + tool responses)
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
                            # Send visual noun card data when the tool completes
                            if part.function_response.name == "show_visual_noun":
                                response_data = part.function_response.response
                                await safe_send(websocket, {
                                    "type": "visual_noun_card",
                                    "data": response_data
                                }, shutdown_event)

                                # Buffer card for Firestore (store gcs_path, not signed URL)
                                if response_data.get("status") == "success":
                                    pending_cards.append({
                                        "term": response_data.get("term", ""),
                                        "translated_term": response_data.get("translated_term", ""),
                                        "brief_explanation": response_data.get("brief_explanation", ""),
                                        "gcs_path": response_data.get("gcs_path", ""),
                                    })

                # Handle transcription events
                if event.input_transcription and event.input_transcription.text:
                    last_input_language = detect_language(event.input_transcription.text)
                    input_buf["text"] = event.input_transcription.text
                    input_buf["language"] = last_input_language

                    logger.info(f"[downstream] input_transcription: lang={last_input_language}, text='{event.input_transcription.text[:80]}'")
                    await safe_send(websocket, {
                        "type": "transcription",
                        "role": "user",
                        "language": last_input_language,
                        "text": event.input_transcription.text
                    }, shutdown_event)

                if event.output_transcription and event.output_transcription.text:
                    text = event.output_transcription.text
                    if '<ctrl46>' in text:
                        text = text.replace('<ctrl46>', '')
                    if '"result":' in text and '"function":' in text:
                        logger.debug("[downstream] Skipping tool response in transcription")
                    else:
                        output_language = "EN" if last_input_language == "JP" else "JP"
                        output_buf["text"] = text
                        output_buf["language"] = output_language
                        logger.info(f"[downstream] output_transcription: text='{text[:80] if text else 'NONE'}'")
                        logger.info(f"[downstream] Sending agent transcription: lang={output_language}")
                        await safe_send(websocket, {
                            "type": "transcription",
                            "role": "agent",
                            "language": output_language,
                            "text": text
                        }, shutdown_event)

                # Handle turn completion — flush buffers and save to Firestore
                if event.turn_complete:
                    _flush_turn(input_buf, output_buf, pending_cards, conversation_turns)
                    # Fire-and-forget save to Firestore
                    asyncio.create_task(_save_conversation_safe(user_id, session_id, conversation_turns))
                    await safe_send(websocket, {"type": "turn_complete"}, shutdown_event)

                # Handle interruption — also flush
                if event.interrupted:
                    _flush_turn(input_buf, output_buf, pending_cards, conversation_turns)
                    await safe_send(websocket, {"type": "interrupted"}, shutdown_event)

            # run_live() ended normally
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
            await asyncio.sleep(1)
            logger.info(f"Reconnecting to Gemini Live API (attempt {retry_count})...")
            await safe_send(websocket, {"type": "reconnecting"}, shutdown_event)


async def _save_conversation_safe(user_id: str, session_id: str, turns: list[dict]):
    """Fire-and-forget wrapper for saving conversation to Firestore."""
    try:
        await save_conversation(user_id, session_id, list(turns))
    except Exception as e:
        logger.error(f"_save_conversation_safe: FAILED — {e}", exc_info=True)


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
        logger.info(f"[ws] Session created successfully")
    except Exception as e:
        logger.error(f"Failed to create session: {e}", exc_info=True)
        await websocket.close(code=1011, reason="Session Init Error")
        return

    # Phase 3: Streaming Loop
    logger.info(f"[ws] Starting streaming loop for user={uid}, session={session_id}")
    shutdown_event = asyncio.Event()
    conversation_turns: list[dict] = []
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(upstream_task(websocket, live_request_queue, shutdown_event))
            tg.create_task(downstream_task(websocket, runner, uid, session_id, live_request_queue, run_config, shutdown_event, conversation_turns))
    except* WebSocketDisconnect:
        logger.info(f"Client {uid} disconnected")
    except* Exception as e:
        logger.error(f"Session error for {uid}: {e}", exc_info=True)
    finally:
        # Phase 4: Cleanup — final save to Firestore
        shutdown_event.set()
        live_request_queue.close()
        if conversation_turns:
            try:
                await save_conversation(uid, session_id, conversation_turns)
            except Exception as e:
                logger.error(f"Final save FAILED: {e}", exc_info=True)
        else:
            logger.info("No turns to save")


