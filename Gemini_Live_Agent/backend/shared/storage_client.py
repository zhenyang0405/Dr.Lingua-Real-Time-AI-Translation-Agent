from google.cloud import storage
import asyncio
import datetime
import os

async def upload_file(bucket_name: str, destination_path: str, file_data: bytes, content_type: str) -> str:
    """Uploads a file to the bucket."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(destination_path)
    
    await asyncio.to_thread(
        blob.upload_from_string,
        file_data,
        content_type=content_type
    )
    return f"gs://{bucket_name}/{destination_path}"

async def download_file(bucket_name: str, source_path: str) -> bytes:
    """Downloads a file from the bucket."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(source_path)
    
    return await asyncio.to_thread(blob.download_as_bytes)

async def test_connection(bucket_name: str) -> bool:
    """Tests the Cloud Storage connection by uploading and deleting a small file."""
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob("test_connection.txt")
        
        await asyncio.to_thread(
            blob.upload_from_string,
            b"test",
            content_type="text/plain"
        )
        await asyncio.to_thread(blob.delete)
        return True
    except Exception as e:
        print(f"Storage connection test failed: {e}")
        return False
async def generate_signed_url(bucket_name: str, path: str, expiration_minutes: int = 60) -> str:
    """Generates a v4 signed URL for reading an object."""
    import google.auth
    from google.oauth2 import service_account

    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'secrets', 'serviceAccountKey.json')

    def _sign():
        if os.path.exists(key_path):
            credentials = service_account.Credentials.from_service_account_file(key_path)
            client = storage.Client(credentials=credentials)
        else:
            client = storage.Client()

        bucket = client.bucket(bucket_name)
        blob = bucket.blob(path)
        return blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=expiration_minutes),
            method="GET",
        )

    return await asyncio.to_thread(_sign)


async def generate_signed_urls_batch(bucket_name: str, paths: list[str], expiration_minutes: int = 60) -> dict[str, str]:
    """Sign multiple GCS paths. Returns {path: signed_url}."""
    tasks = [generate_signed_url(bucket_name, p, expiration_minutes) for p in paths]
    results = await asyncio.gather(*tasks)
    return dict(zip(paths, results))


async def list_blobs(bucket_name: str, prefix: str) -> list[dict]:
    """Lists blobs under a prefix. Returns [{name, path, updated}]."""
    def _list():
        client = storage.Client()
        blobs = list(client.list_blobs(bucket_name, prefix=prefix))
        return [
            {"name": b.name.split("/")[-1], "path": b.name, "updated": b.updated.isoformat() if b.updated else None}
            for b in blobs
        ]
    return await asyncio.to_thread(_list)
