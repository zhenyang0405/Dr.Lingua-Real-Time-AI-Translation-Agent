import os
from dotenv import load_dotenv

# Load environment variables from backend/.env before route imports
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from shared.auth import verify_token
from api.app.routes.health import router as health_router
from api.app.routes.documents import router as documents_router
from api.app.routes.conversations import router as conversations_router

app = FastAPI(title="Dr. Lingua API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://live-api-challenge--theta-citron-488903-i3.us-central1.hosted.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Middleware
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Exclude /health and CORS preflight requests from authentication
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)
        
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing or invalid authentication token"})
        
    token = auth_header.split(" ")[1]
    try:
        uid = await verify_token(token)
        request.state.uid = uid
    except ValueError as e:
        return JSONResponse(status_code=401, content={"detail": str(e)})

    response = await call_next(request)
    return response

# Include routes
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(conversations_router)
