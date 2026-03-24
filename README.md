# Dr. Lingua

**Real-time AI translation agent that goes beyond words — combining voice-driven document translation with visual context for culturally-specific terms, powered by a microservices architecture on Google Cloud.**

[![Gemini](https://img.shields.io/badge/Model-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/gemini-api)
[![Google ADK](https://img.shields.io/badge/Framework-Google%20ADK-FF6F00?logo=google&logoColor=white)](https://google.github.io/adk-docs/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Cloud Run](https://img.shields.io/badge/Infra-Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Firebase](https://img.shields.io/badge/Auth-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

---

## Problem Statement

Language barriers in professional and cross-cultural settings extend far beyond word-for-word translation. Researchers reading foreign-language papers struggle with domain-specific terminology in tables, charts, and diagrams. Travelers conversing with locals miss cultural context behind unfamiliar nouns — hearing "たこ焼き" translated as "takoyaki" doesn't help if you've never seen one.

Existing translation tools treat language as a text-in, text-out problem. Dr. Lingua treats it as a **multimodal understanding problem**: it translates documents while preserving spatial layout in images, provides real-time speech interpretation between two languages, and proactively generates visual cards for culturally-specific concepts that words alone can't convey.

---

## Architecture Overview

Dr. Lingua follows a **microservices architecture** with three independently deployable backend services, each running as a containerized Cloud Run instance behind WebSocket or REST interfaces.
<img width="2754" height="1536" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/65df38f4-1fd6-426f-8302-0248198f2bea" />

### Service Boundaries & Communication
**Data Flow:**

1. **API Service** handles REST operations: document uploads to Cloud Storage, conversation history retrieval from Firestore, and signed URL generation for secure asset access.
2. **Streaming Service** manages bidirectional WebSocket connections for document translation sessions. It receives audio (PCM 16kHz) and document frames (JPEG) from the client, routes them through Google ADK to Gemini Live API for real-time voice interaction, and streams translated audio (PCM 24kHz) back alongside tool call results (translation annotations, image translations).
3. **Visual Noun Service** handles live conversation interpretation sessions. It detects culturally-specific nouns in real-time speech, generates representative images via Gemini image generation, uploads them to Cloud Storage, and delivers visual noun cards to the client — all without interrupting the audio translation stream.

**Shared Layer:** All three services share a common `shared/` module containing Firebase Auth token verification, Firestore client operations, and Cloud Storage utilities, ensuring consistent authentication and data access patterns across service boundaries.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS, Firebase SDK |
| **Backend Services** | Python 3.12, FastAPI, Uvicorn, WebSockets |
| **AI/ML** | Google ADK (Agent Development Kit), Gemini 2.5 Flash (native audio), Gemini 3.1 Flash (image generation), Gemini Live API (bidirectional streaming) |
| **Data Stores** | Cloud Firestore (conversations, translations), Cloud Storage (documents, generated images) |
| **Auth** | Firebase Authentication (anonymous + token verification) |
| **Infrastructure** | Google Cloud Run, Artifact Registry, Secret Manager, Terraform (IaC) |
| **Containerization** | Docker, Docker Compose |
| **Real-time Communication** | WebSocket (bidirectional audio + frame streaming), REST API |

---

## Key Features

- **Real-Time Voice-Driven Document Translation** — Stream audio and document page frames simultaneously over WebSocket. The Gemini Live API agent sees the document, hears your questions, and speaks translations back while persisting annotation cards to Firestore in real-time. Supports region selection for targeted translation of tables, charts, and diagrams.

- **Visual Noun Detection in Live Conversation** — During bilingual interpretation (English ↔ Japanese), the agent proactively identifies culturally-specific nouns the listener wouldn't recognize, generates representative images via Gemini image generation, and delivers visual cards without interrupting the audio stream. Uses `NON_BLOCKING` tool behavior so image generation runs asynchronously.

- **Image-Aware Translation with Spatial Preservation** — Beyond text translation, Dr. Lingua can translate entire document pages or user-selected regions as images, replacing all text labels, headers, and annotations in-place while preserving the original layout, colors, and styling.

- **Context Window Compression for Extended Sessions** — Configured with sliding window compression (`trigger_tokens: 120K`, `target_tokens: 60K`) and session resumption to handle long document review sessions and continuous screen share streams without hitting context limits.

- **Infrastructure as Code with Terraform** — Complete GCP infrastructure defined in Terraform including Cloud Run services, IAM roles, Artifact Registry, and Secret Manager. Reproducible deployments with configurable scaling (0→4 instances) and 1-hour WebSocket timeout support.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** (for the frontend)
- **Python** 3.12+ (for backend services)
- **Docker** and **Docker Compose** (for containerized local development)
- **Google Cloud SDK** (`gcloud`) authenticated with a GCP project
- A **Firebase project** with Authentication enabled (anonymous sign-in)
- A **Gemini API key** from Google AI Studio

### Environment Setup

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/dr-lingua.git
cd dr-lingua
```

2. **Configure backend environment variables:**

Create `backend/.env`:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GCS_BUCKET=your-project-id.firebasestorage.app
GOOGLE_API_KEY=your-gemini-api-key
```

Place your Firebase service account key at `backend/secrets/serviceAccountKey.json`.

3. **Configure frontend environment variables:**

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_STREAMING_URL=ws://localhost:8002
NEXT_PUBLIC_VISUAL_NOUN_URL=ws://localhost:8003
```

### Running with Docker Compose

```bash
cd backend
docker compose up --build
```

This starts all three backend services:

| Service | Port | Protocol |
|---|---|---|
| API Service | `localhost:8001` | REST/HTTP |
| Streaming Service | `localhost:8002` | WebSocket |
| Visual Noun Service | `localhost:8003` | WebSocket |

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

### Running Without Docker

```bash
# Terminal 1 — API Service
cd backend
pip install -r api/requirements.txt
PYTHONPATH=. uvicorn api.app.main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Streaming Service
pip install -r streaming/requirements.txt
PYTHONPATH=. uvicorn streaming.app.main:app --host 0.0.0.0 --port 8002

# Terminal 3 — Visual Noun Service
pip install -r visual_noun/requirements.txt
PYTHONPATH=. uvicorn visual_noun.app.main:app --host 0.0.0.0 --port 8003
```

### Deploying to GCP with Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform apply
```

---

## API Documentation & Usage Examples

### REST API (API Service)

**Health Check:**

```bash
curl http://localhost:8001/health
# → {"status": "ok", "service": "dr-lingua-api"}
```

**Upload a Document:**

```bash
curl -X POST http://localhost:8001/api/documents \
  -H "Authorization: Bearer <firebase-id-token>" \
  -F "file=@research-paper.pdf"

# → {"doc_id": "uid/1234_research-paper.pdf", "filename": "research-paper.pdf", "gcs_path": "documents/uid/1234_research-paper.pdf", "gcs_uri": "gs://bucket/..."}
```

**List Documents:**

```bash
curl http://localhost:8001/api/documents \
  -H "Authorization: Bearer <firebase-id-token>"

# → {"documents": [{"doc_id": "...", "filename": "research-paper.pdf", "updated": "2025-01-01T..."}]}
```

**List Conversations:**

```bash
curl http://localhost:8001/api/conversations \
  -H "Authorization: Bearer <firebase-id-token>"

# → {"conversations": [{"session_id": "...", "summary": "Translate page 3...", "message_count": 12, "card_count": 4}]}
```

### WebSocket Protocol (Streaming & Visual Noun Services)

**Connection lifecycle:**

```
Client                          Server
  │── connect ──────────────────▶│
  │── {"type":"auth","token":"…"}▶│
  │◀── {"type":"auth_success"}───│
  │── {"type":"audio","data":"…"}▶│  (base64 PCM 16kHz)
  │◀── {"type":"audio","data":"…"}│  (base64 PCM 24kHz)
  │◀── {"type":"transcription"}──│
  │◀── {"type":"tool_call"}──────│
  │◀── {"type":"turn_complete"}──│
```

**Upstream message types:** `audio` (PCM 16kHz), `screen_frame` (JPEG), `document_frame` (JPEG + optional selection coords), `text`, `set_document`, `activity_start`, `activity_end`.

**Downstream message types:** `audio` (PCM 24kHz), `transcription` (user/agent with language detection), `tool_call`, `visual_noun_card`, `turn_complete`, `interrupted`, `error`, `reconnecting`.

---

## Design Decisions & Trade-offs

### Why Three Separate Services Instead of One Monolith?

Each service has fundamentally different runtime characteristics. The API service handles short-lived REST requests and can scale to zero aggressively. The Streaming and Visual Noun services maintain long-lived WebSocket connections (up to 1 hour) with bidirectional audio streams, requiring higher memory (1Gi vs 512Mi) and longer Cloud Run timeouts (3600s). Separating them allows independent scaling — document translation sessions can spike to 4 instances while the API stays at 2.

### Why Google ADK Over Direct Gemini API Calls?

ADK provides `LiveRequestQueue` for multiplexing real-time audio, image frames, and text content over a single bidirectional stream to Gemini Live API. Building this from scratch would require managing audio chunking, interleave ordering, and tool call lifecycle manually. ADK also handles session resumption and context window compression natively, which are critical for long translation sessions where screen share video quickly fills the context window.

### Why In-Memory Session Storage Instead of Redis?

The ADK `InMemorySessionService` was chosen over distributed session storage because each WebSocket connection is pinned to a single Cloud Run instance for its lifetime. There's no need for cross-instance session sharing — if the connection drops, the client reconnects and creates a new session. This eliminates the operational overhead of a Redis cluster while session resumption handles reconnection gracefully.

### Why Firestore Over PostgreSQL?

Firestore's real-time listener capability (`onSnapshot`) enables the frontend annotation panel to update instantly when the agent saves a translation — without polling or additional WebSocket messages. The document model (conversations → sessions → turns) maps naturally to Firestore's subcollection hierarchy. For a production system with complex querying needs, PostgreSQL with a change data capture pattern would be more appropriate.

### Why `NON_BLOCKING` Tool Behavior for Visual Nouns?

Image generation takes 3–5 seconds per visual noun card. Using blocking tools would pause the audio translation stream while waiting for image generation to complete. The `NonBlockingFunctionTool` subclass allows the agent to continue speaking the translation while images are generated and uploaded asynchronously, then the tool response streams the card data to the client independently.

### Why Client-Side VAD for Visual Noun Mode?

The Visual Noun service uses client-managed Voice Activity Detection (push-to-talk with `activity_start`/`activity_end`) instead of Gemini's automatic detection. In a two-speaker interpretation scenario, automatic VAD cannot reliably distinguish between the two speakers and tends to trigger on the agent's own audio playback, creating echo loops. Client-controlled VAD with explicit activity boundaries gives cleaner turn management.

---

## Performance & Scale Considerations

- **WebSocket Scaling:** Cloud Run is configured with 0→4 max instances for streaming services, supporting approximately 4 concurrent long-lived translation sessions per instance. The `session_resumption` config handles the ~10-minute Gemini Live API timeout by transparently reconnecting.

- **Context Window Management:** Screen share and document frames consume context rapidly (video at ~1 frame/sec). The `context_window_compression` config triggers at 120K tokens and compresses to 60K via sliding window, enabling sessions of 30+ minutes without degradation.

- **Document Frame Optimization:** Document pages are rendered client-side as 768×768 JPEG at 80% quality (~50-80KB per frame) and sent at 3-second intervals, balancing visual fidelity against bandwidth. Selection regions are composited onto the frame with a yellow overlay so the agent can "see" what the user has selected.

- **Audio Pipeline Latency:** Audio is captured at 16kHz, chunked at 128 samples/frame (~8ms) in an AudioWorklet, and streamed as base64 PCM. Playback at 24kHz uses scheduled `AudioBufferSourceNode` with a 50ms buffer to prevent gaps. Total end-to-end latency (speech → translation audio) is bounded by Gemini's response time (~1-2 seconds).

- **Signed URL Batching:** When loading conversation history with image cards, signed URLs are generated in parallel via `asyncio.gather` to avoid sequential latency on conversations with many visual noun cards.

- **Retry & Reconnection:** Both streaming services implement exponential retry (up to 5 attempts) for Gemini Live API disconnections, with `reconnecting` status messages sent to the client. The frontend manages its own WebSocket reconnection (up to 3 attempts with 2-second backoff).

---

## Future Improvements / Roadmap

- **Support for Additional Language Pairs** — Currently the Visual Noun conversation mode is hardcoded to English ↔ Japanese. Generalize language detection and pair configuration to support arbitrary language combinations.

- **Persistent Session Storage** — Replace `InMemorySessionService` with a distributed session store (Redis or Firestore-backed) to support Cloud Run instance recycling during long sessions without losing agent context.

- **Streaming Translation Annotations** — Currently translations appear only after tool calls complete. Implement progressive annotation updates using Firestore real-time listeners on the streaming service side to show partial translations as the agent speaks.

- **Multi-User Conversation Support** — The Visual Noun service currently assumes exactly two speakers. Extend speaker diarization to support 3+ participants in group translation scenarios.

- **Offline Document Translation** — Add a batch processing mode using the standard Gemini API (non-Live) for translating entire documents asynchronously, with results stored in Firestore and downloadable as annotated PDFs.

- **Caching for Visual Noun Cards** — Implement a lookup cache (Firestore or Redis) of previously generated visual noun images to avoid regenerating the same culturally-specific term across sessions.

- **End-to-End Testing** — Add integration tests for the WebSocket lifecycle (auth → streaming → turn completion → disconnection) and Firestore persistence using test containers.

- **Rate Limiting & Abuse Prevention** — Add per-user rate limiting on document uploads and WebSocket connections to prevent resource abuse in the public-facing deployment.

---


## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
