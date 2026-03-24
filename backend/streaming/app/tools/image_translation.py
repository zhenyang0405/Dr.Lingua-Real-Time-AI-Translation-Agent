import asyncio
import io
import os
import uuid

from PIL import Image
from google import genai
from google.genai import types
from google.adk.tools.tool_context import ToolContext
from google.cloud import firestore

from shared.firestore_client import db
from shared.storage_client import upload_file
from streaming.app.active_documents import active_documents
from streaming.app.latest_frames import latest_frames

GCS_BUCKET = os.environ.get("GCS_BUCKET", "")


async def _translate_and_save(
    frame_bytes: bytes,
    description: str,
    target_language: str,
    section_id: str,
    nuance_notes: str,
    user_id: str,
    session_id: str,
) -> str:
    """Shared logic: call Gemini image generation, upload to GCS, save to Firestore."""
    client = genai.Client()
    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-3.1-flash-image-preview",
        contents=[
            types.Content(parts=[
                types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg"),
                types.Part(text=
                    f"Edit this image: replace ALL text (labels, titles, legends, "
                    f"table headers, axis labels, annotations, body text) with their "
                    f"{target_language} translations. Keep the exact same layout, colors, "
                    f"fonts, and styling. Only change the text language. "
                    f"Do not add or remove any visual elements."
                ),
            ])
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    # Extract image bytes from response
    image_bytes = None
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            image_bytes = part.inline_data.data
            break

    if not image_bytes:
        return "Error: The image generation model did not return an image. Please try again."

    # Upload to Cloud Storage
    blob_path = f"image_translations/{user_id}/{uuid.uuid4().hex}.png"
    await upload_file(GCS_BUCKET, blob_path, image_bytes, "image/png")

    # Write to Firestore (store gcs_path only; signed URL is generated on read)
    doc_name = active_documents.get(session_id, "unknown")
    doc_ref = db.collection("translations").document(user_id).collection(doc_name).document()
    await doc_ref.set({
        "section_id": section_id,
        "source_text": "",
        "translated_text": "",
        "nuance_notes": nuance_notes,
        "gcs_path": blob_path,
        "image_description": description,
        "target_language": target_language,
        "timestamp": firestore.SERVER_TIMESTAMP,
    })

    return f"Translated image for '{section_id}' has been saved and will appear in the annotation panel."


async def translate_page(
    description: str,
    target_language: str,
    section_id: str = "Page Translation",
    nuance_notes: str = "",
    tool_context: ToolContext = None,
) -> str:
    """Translate the entire current document page by editing the image.

    Call this tool when the user asks you to translate the whole page, or when they want
    a full-page translation of visual content (tables, charts, diagrams, mixed layouts).

    Args:
        description: Describe what you see on the page and what text needs translating.
        target_language: The language to translate into (e.g. "English", "Chinese").
        section_id: A label for this translation (e.g. "Page 1", "Full Page").
        nuance_notes: Optional notes about translation choices or cultural context.
    """
    if not tool_context:
        return "Error: No tool context available."

    user_id = tool_context.user_id
    session_id = tool_context.session.id

    frame_data = latest_frames.get(session_id)
    if not frame_data:
        return "Error: No document is currently visible. Please ask the user to open a document first."

    return await _translate_and_save(
        frame_bytes=frame_data.image,
        description=description,
        target_language=target_language,
        section_id=section_id,
        nuance_notes=nuance_notes,
        user_id=user_id,
        session_id=session_id,
    )


async def translate_selection(
    description: str,
    target_language: str,
    section_id: str = "Selection Translation",
    nuance_notes: str = "",
    tool_context: ToolContext = None,
) -> str:
    """Translate only the selected region of the document by editing that part of the image.

    Call this tool when the user has drawn a selection box (yellow highlight) on the document
    and asks you to translate just that area — a specific table, chart, diagram, or paragraph.

    Args:
        description: Describe what you see in the selected area and what text needs translating.
        target_language: The language to translate into (e.g. "English", "Chinese").
        section_id: A label for this translation (e.g. "Table 1", "Selected Chart").
        nuance_notes: Optional notes about translation choices or cultural context.
    """
    if not tool_context:
        return "Error: No tool context available."

    user_id = tool_context.user_id
    session_id = tool_context.session.id

    frame_data = latest_frames.get(session_id)
    if not frame_data:
        return "Error: No document is currently visible. Please ask the user to open a document first."

    if not frame_data.selection:
        return "Error: No area is selected. Please ask the user to draw a selection box on the document first."

    # Crop to selection region
    img = Image.open(io.BytesIO(frame_data.image))
    s = frame_data.selection
    crop_box = (
        int(s["x"] * img.width),
        int(s["y"] * img.height),
        int((s["x"] + s["width"]) * img.width),
        int((s["y"] + s["height"]) * img.height),
    )
    img = img.crop(crop_box)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    frame_bytes = buf.getvalue()

    return await _translate_and_save(
        frame_bytes=frame_bytes,
        description=description,
        target_language=target_language,
        section_id=section_id,
        nuance_notes=nuance_notes,
        user_id=user_id,
        session_id=session_id,
    )
