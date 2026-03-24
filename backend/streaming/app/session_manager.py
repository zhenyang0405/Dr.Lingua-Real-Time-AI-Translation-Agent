from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from streaming.app.agent import agent

APP_NAME = "dr_lingua"

# Create once at application startup (module-level)
session_service = InMemorySessionService()
runner = Runner(
    agent=agent,  # imported from agent.py
    app_name=APP_NAME,
    session_service=session_service,
)

def create_run_config() -> RunConfig:
    """Create RunConfig for a Dr. Lingua streaming session."""
    return RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck"  # Test others: Puck, Charon, Aoede
                )
            )
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        # Context window compression for longer sessions (screen share = video = 2 min limit without this)
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=120000,
            sliding_window=types.SlidingWindow(target_tokens=60000),
        ),
        # Session resumption for connection timeouts (~10 min)
        session_resumption=types.SessionResumptionConfig(),
    )

async def create_session(user_id: str, session_id: str):
    """Get or create an ADK session for this user."""
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )
    return session
