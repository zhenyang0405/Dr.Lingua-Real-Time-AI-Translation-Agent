from google.cloud import firestore

# Initialize the async client
db = firestore.AsyncClient()

async def read_document(collection: str, doc_id: str) -> dict | None:
    doc_ref = db.collection(collection).document(doc_id)
    doc = await doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None

async def write_document(collection: str, doc_id: str, data: dict) -> None:
    doc_ref = db.collection(collection).document(doc_id)
    await doc_ref.set(data)

async def save_conversation(uid: str, session_id: str, turns: list[dict]) -> None:
    """Upsert a conversation document at conversations/{uid}/{session_id}."""
    doc_ref = db.collection("conversations").document(uid).collection("sessions").document(session_id)
    summary = ""
    for t in turns:
        inp = t.get("input")
        if inp and inp.get("text"):
            summary = inp["text"][:80]
            break
    card_count = sum(len(t.get("output", {}).get("cards", [])) for t in turns)
    await doc_ref.set({
        "session_id": session_id,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "summary": summary,
        "message_count": len(turns) * 2,
        "card_count": card_count,
        "turns": turns,
    }, merge=True)


async def list_conversations(uid: str, limit: int = 20) -> list[dict]:
    """List conversations for a user, most recent first."""
    query = (db.collection("conversations").document(uid)
             .collection("sessions")
             .order_by("created_at", direction=firestore.Query.DESCENDING)
             .limit(limit))
    results = []
    async for doc in query.stream():
        d = doc.to_dict()
        d.pop("turns", None)
        results.append(d)
    return results


async def get_conversation(uid: str, session_id: str) -> dict | None:
    """Get a full conversation document."""
    doc_ref = db.collection("conversations").document(uid).collection("sessions").document(session_id)
    doc = await doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None


async def test_connection() -> bool:
    try:
        test_doc_ref = db.collection("_system_test").document("connection_test")
        await test_doc_ref.set({"status": "ok"})
        doc = await test_doc_ref.get()
        return doc.exists
    except Exception as e:
        print(f"Firestore connection test failed: {e}")
        return False
