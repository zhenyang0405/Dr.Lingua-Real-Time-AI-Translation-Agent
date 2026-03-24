from fastapi import APIRouter
from shared import firestore_client, storage_client
from fastapi import Request

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "dr-lingua-api"}

@router.get("/api/test")
async def test_api(request: Request):
    firestore_ok = await firestore_client.test_connection()
    storage_ok = await storage_client.test_connection("your-firebase-project-id.firebasestorage.app") # Placeholder, usually from env
    uid = getattr(request.state, "uid", None)
    
    return {
        "firestore": firestore_ok,
        "storage": storage_ok,
        "uid": uid
    }
