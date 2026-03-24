import os
from fastapi import APIRouter, Request, HTTPException
from shared.firestore_client import list_conversations, get_conversation
from shared.storage_client import generate_signed_urls_batch

router = APIRouter()

GCS_BUCKET = os.environ.get("GCS_BUCKET", "")


@router.get("/api/conversations")
async def list_conversations_endpoint(request: Request):
    """List past conversations for the authenticated user."""
    uid = request.state.uid
    conversations = await list_conversations(uid)
    return {"conversations": conversations}


@router.get("/api/conversations/{session_id}")
async def get_conversation_endpoint(session_id: str, request: Request):
    """Get a full conversation with re-signed image URLs."""
    uid = request.state.uid
    conversation = await get_conversation(uid, session_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Re-sign all GCS paths in cards
    gcs_paths = []
    for turn in conversation.get("turns", []):
        output = turn.get("output", {})
        for card in output.get("cards", []):
            if card.get("gcs_path"):
                gcs_paths.append(card["gcs_path"])

    if gcs_paths and GCS_BUCKET:
        signed_urls = await generate_signed_urls_batch(GCS_BUCKET, gcs_paths)
        for turn in conversation.get("turns", []):
            output = turn.get("output", {})
            for card in output.get("cards", []):
                if card.get("gcs_path") in signed_urls:
                    card["image_url"] = signed_urls[card["gcs_path"]]

    return conversation
