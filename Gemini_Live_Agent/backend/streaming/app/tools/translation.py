from google.adk.tools.tool_context import ToolContext
from google.cloud import firestore
from shared.firestore_client import db
from streaming.app.active_documents import active_documents


async def save_translation(
    section_id: str,
    translated_text: str,
    source_text: str = "",
    nuance_notes: str = "",
    tool_context: ToolContext = None,
) -> str:
    """Display a translated section in the annotation panel.

    ALWAYS call this tool when translating any section of text.

    Args:
        section_id: Identifier for the section
        translated_text: The complete translation
        source_text: The original text being translated
        nuance_notes: Optional notes about translation choices
    """
    if tool_context:
        user_id = tool_context.user_id
        session_id = tool_context.session.id
        doc_name = active_documents.get(session_id, "unknown")

        doc_ref = db.collection("translations").document(user_id).collection(doc_name).document()
        await doc_ref.set({
            "section_id": section_id,
            "source_text": source_text,
            "translated_text": translated_text,
            "nuance_notes": nuance_notes,
            "timestamp": firestore.SERVER_TIMESTAMP,
        })

    return f"Translation for '{section_id}' saved successfully."
