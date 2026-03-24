import os
import time
from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from shared import storage_client
from shared.firestore_client import db

router = APIRouter(prefix="/api/documents", tags=["documents"])

GCS_BUCKET = os.getenv("GCS_BUCKET", "")


def _make_doc_id(uid: str, filename: str) -> str:
    """Creates a stable, URL-safe doc_id from uid + timestamp + filename."""
    ts = int(time.time())
    safe_name = filename.replace(" ", "_")
    return f"{uid}/{ts}_{safe_name}"


@router.post("")
async def upload_document(request: Request, file: UploadFile = File(...)):
    """
    Upload a document (PDF or image) to GCS.
    Returns: { doc_id, filename, gcs_path }
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    content_type = file.content_type or "application/octet-stream"
    allowed_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF and images."
        )

    data = await file.read()
    doc_id = _make_doc_id(uid, file.filename or "document")
    gcs_path = f"documents/{doc_id}"

    gcs_uri = await storage_client.upload_file(
        bucket_name=GCS_BUCKET,
        destination_path=gcs_path,
        file_data=data,
        content_type=content_type,
    )

    return JSONResponse({
        "doc_id": doc_id,
        "filename": file.filename,
        "gcs_path": gcs_path,
        "gcs_uri": gcs_uri,
    })


@router.get("/{doc_id:path}/url")
async def get_document_url(doc_id: str, request: Request):
    """
    Generate a signed URL for a document.
    Returns: { signed_url, filename }
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Ensure the doc belongs to this user
    if not doc_id.startswith(uid + "/"):
        raise HTTPException(status_code=403, detail="Access denied")

    gcs_path = f"documents/{doc_id}"
    filename = doc_id.split("/")[-1]

    try:
        signed_url = await storage_client.generate_signed_url(
            bucket_name=GCS_BUCKET,
            path=gcs_path,
            expiration_minutes=60,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate signed URL: {e}")

    return JSONResponse({"signed_url": signed_url, "filename": filename})


@router.get("")
async def list_documents(request: Request):
    """
    List all documents uploaded by the authenticated user.
    Returns: { documents: [{ doc_id, filename, updated }] }
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    prefix = f"documents/{uid}/"
    blobs = await storage_client.list_blobs(GCS_BUCKET, prefix)

    documents = [
        {
            "doc_id": f"{uid}/{b['name']}",
            "filename": b["name"].split("_", 1)[-1] if "_" in b["name"] else b["name"],
            "updated": b["updated"],
        }
        for b in blobs
    ]

    return JSONResponse({"documents": documents})


@router.get("/translations/{doc_name}/sign-urls")
async def sign_translation_urls(doc_name: str, request: Request):
    """
    Re-sign expired image URLs for translation docs.
    Returns: { signed_urls: { doc_id: signed_url } }
    """
    uid = getattr(request.state, "uid", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    col_ref = db.collection("translations").document(uid).collection(doc_name)
    snapshot = await col_ref.get()

    gcs_paths: dict[str, str] = {}  # doc_id -> gcs_path
    for doc in snapshot:
        data = doc.to_dict()
        if data.get("gcs_path"):
            gcs_paths[doc.id] = data["gcs_path"]

    if not gcs_paths:
        return JSONResponse({"signed_urls": {}})

    signed = await storage_client.generate_signed_urls_batch(
        GCS_BUCKET, list(gcs_paths.values()), expiration_minutes=1440
    )

    result = {doc_id: signed[path] for doc_id, path in gcs_paths.items()}
    return JSONResponse({"signed_urls": result})
