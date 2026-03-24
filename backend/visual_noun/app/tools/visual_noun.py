import asyncio
import os
import uuid

from google import genai
from google.genai import types
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext

from shared.storage_client import upload_file, generate_signed_url


class NonBlockingFunctionTool(FunctionTool):
    """A FunctionTool that declares NON_BLOCKING behavior for async execution."""

    def _get_declaration(self):
        declaration = super()._get_declaration()
        declaration.behavior = types.Behavior.NON_BLOCKING
        return declaration

GCS_BUCKET = os.environ.get("GCS_BUCKET", "")


async def show_visual_noun(
    term: str,
    translated_term: str,
    image_query: str,
    brief_explanation: str,
    tool_context: ToolContext = None,
) -> dict:
    """Show a visual card for a culturally-specific noun that the listener may not recognize.

    Call this tool when the speaker mentions a noun that is culturally specific and
    the listener likely would not recognize even after hearing the translation.
    Examples: regional foods, transport types, cultural objects, unfamiliar landmarks.

    Do NOT call this for universally understood nouns (car, water, phone, house).
    Do NOT call this for terms already shown earlier in the conversation.

    Args:
        term: The original term in the source language (e.g. "たこ焼き").
        translated_term: The term in the target language (e.g. "takoyaki").
        image_query: An optimized English description for generating a representative image.
                     Be specific (e.g. "Japanese takoyaki octopus ball street food" not just "food").
        brief_explanation: A one-sentence explanation for the listener (~100 chars max).
    """
    if not tool_context:
        return {"status": "error", "message": "No tool context available."}

    # Prevent ADK from feeding tool response back to the agent for summarization
    tool_context.actions.skip_summarization = True

    user_id = tool_context.user_id

    # Generate image via Gemini
    client = genai.Client()
    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash-image",
        contents=[
            types.Content(parts=[
                types.Part(text=
                    f"Generate a clear, realistic photograph of: {image_query}. "
                    f"The image should look like a real photo that helps someone "
                    f"understand what this item or concept looks like. "
                    f"No text overlay or labels needed."
                ),
            ])
        ],
        config=types.GenerateContentConfig(
            image_config = types.ImageConfig(
                aspect_ratio="4:3",
            ),
            response_modalities=[
                "IMAGE",
                "TEXT",
            ],
        ),
    )

    # Extract image bytes from response
    image_bytes = None
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            image_bytes = part.inline_data.data
            break

    if not image_bytes:
        return {
            "status": "error",
            "message": "Image generation did not return an image.",
            "term": term,
            "translated_term": translated_term,
            "brief_explanation": brief_explanation,
        }

    # Upload to Cloud Storage
    blob_path = f"visual_nouns/{user_id}/{uuid.uuid4().hex}.png"
    await upload_file(GCS_BUCKET, blob_path, image_bytes, "image/png")

    # Generate signed URL (24 hour expiry)
    signed_url = await generate_signed_url(GCS_BUCKET, blob_path, expiration_minutes=1440)

    return {
        "status": "success",
        "image_url": signed_url,
        "gcs_path": blob_path,
        "term": term,
        "translated_term": translated_term,
        "brief_explanation": brief_explanation,
    }


show_visual_noun_tool = NonBlockingFunctionTool(func=show_visual_noun)
