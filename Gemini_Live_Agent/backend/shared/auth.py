import firebase_admin
from firebase_admin import auth as firebase_auth
import asyncio

from firebase_admin import credentials
import os

# Initialize Firebase Admin app using the service account key if available
if not firebase_admin._apps:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(current_dir, '..', 'secrets', 'serviceAccountKey.json')
    
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    else:
        # Fallback to Application Default Credentials
        firebase_admin.initialize_app()

async def verify_token(token: str) -> str:
    """
    Verifies a Firebase ID token and returns the uid.
    Raises ValueError if verification fails.
    """
    try:
        decoded_token = await asyncio.to_thread(
            firebase_auth.verify_id_token, token
        )
        return decoded_token['uid']
    except Exception as e:
        raise ValueError(f"Invalid token: {e}")
