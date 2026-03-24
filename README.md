# 🌐 Dr. Lingua — Real-Time AI Translation Agent

**Devpost: Gemini Live Agent Challenge**

Dr. Lingua is a real-time AI translation agent built on **Google ADK** and **Gemini Live API**, featuring two distinct modes: **Document Translation** (translate research papers, contracts, and manuals with voice + screen sharing) and **Live Conversation** (real-time spoken interpretation between two languages with AI-generated visual context cards).

Built and deployed solo as a 3-microservice architecture on Google Cloud.
<img width="2754" height="1536" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/2df1f79b-9e8f-41f6-b893-7533dfb19f12" />

---

## ✨ Features

### 📄 Document Translation Mode
- **Voice-driven translation** — speak to Dr. Lingua in any language and receive live audio translations with sub-second latency via bidirectional WebSocket streaming
- **Screen sharing + document viewer** — upload PDFs or images, and the agent sees the document in real-time via frame streaming
- **Selection-based translation** — draw a yellow selection box on tables, charts, or diagrams to translate just that region using Gemini image generation
- **Full-page image translation** — translate entire document pages while preserving layout, colors, and styling
- **Annotation panel** — all translations are persisted to Firestore and displayed as annotation cards with source text, translated text, and nuance notes
- **Multi-language auto-detection** — Dr. Lingua auto-detects the user's spoken language and responds in the same language

### 🎙️ Live Conversation Mode (Visual Noun Interpreter)
- **Real-time spoken interpretation** — acts as an invisible interpreter between two speakers (English ↔ Japanese), translating each utterance into the other language
- **Visual noun cards** — when a speaker mentions a culturally-specific noun (regional food, landmarks, cultural objects), the agent proactively generates an AI image and displays it as a visual reference card
- **Non-blocking tool execution** — visual noun image generation runs asynchronously using ADK's `NON_BLOCKING` tool behavior, so the voice translation continues uninterrupted
- **Push-to-talk with VAD** — AudioWorklet-based voice capture at 16kHz with bandpass-filtered voice activity detection for visual feedback
- **Conversation history** — past conversations are saved to Firestore with full transcript, visual noun cards, and re-signable GCS image URLs

---

## 🏗️ Architecture

Dr. Lingua is a **3-microservice backend** with a **Next.js frontend**, all deployed on Google Cloud:

| Service | Stack | Port | Description |
|---|---|---|---|
| **API Service** | FastAPI, Cloud Run | 8001 | REST API for document uploads, conversation history, signed URL generation |
| **Streaming Service** | FastAPI + WebSocket, Cloud Run | 8002 | Bidirectional audio/video streaming via Google ADK + Gemini Live API for document translation |
| **Visual Noun Service** | FastAPI + WebSocket, Cloud Run | 8003 | Real-time spoken interpretation with AI-generated visual noun cards |
| **Frontend** | Next.js 15, React, TypeScript | 3000 | Firebase App Hosting with document viewer, annotation panel, two-column transcript UI |

### Backend Services

Each backend service is independently containerized with Docker and deployed to Cloud Run:

```
backend/
├── api/                    # REST API (document management, conversation history)
│   ├── app/
│   │   ├── main.py         # FastAPI app with auth middleware
│   │   └── routes/
│   │       ├── documents.py    # Upload, list, signed URLs
│   │       ├── conversations.py # Past conversation retrieval
│   │       └── health.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── streaming/              # WebSocket streaming (document translation)
│   ├── app/
│   │   ├── main.py         # WebSocket lifecycle (auth → session → upstream/downstream)
│   │   ├── agent.py        # Dr. Lingua agent definition + system instruction
│   │   ├── session_manager.py  # ADK Runner, RunConfig, session creation
│   │   ├── active_documents.py # Per-session active document tracking
│   │   ├── latest_frames.py    # Latest document frame store for tool access
│   │   └── tools/
│   │       ├── translation.py      # save_translation — text annotation tool
│   │       └── image_translation.py # translate_page / translate_selection — image editing tools
│   ├── Dockerfile
│   └── requirements.txt
│
├── visual_noun/            # WebSocket streaming (live conversation interpreter)
│   ├── app/
│   │   ├── main.py         # WebSocket lifecycle + conversation persistence
│   │   ├── agent.py        # Visual Noun interpreter agent + system instruction
│   │   ├── session_manager.py
│   │   └── tools/
│   │       └── visual_noun.py  # NonBlockingFunctionTool for async image generation
│   ├── Dockerfile
│   └── requirements.txt
│
├── shared/                 # Shared modules across services
│   ├── auth.py             # Firebase token verification
│   ├── firestore_client.py # Firestore async client (conversations, translations)
│   └── storage_client.py   # GCS upload, download, signed URL generation
│
└── docker-compose.yml      # Local development with all 3 services
```

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page (mode selection)
│   │   ├── translate/page.tsx    # Document translation mode
│   │   └── conversation/page.tsx # Live conversation mode
│   ├── components/
│   │   ├── AudioManager.tsx          # Mic capture + PCM playback (24kHz)
│   │   ├── MicBar.tsx                # Push-to-talk with VAD wave animation
│   │   ├── WebSocketManager.tsx      # Streaming service WebSocket provider
│   │   ├── VisualNounWebSocketProvider.tsx # Visual noun WebSocket provider
│   │   ├── DocumentViewerPanel.tsx   # PDF/image viewer with selection drawing
│   │   ├── DocumentUploadPanel.tsx   # Upload + lazy page rendering
│   │   ├── AnnotationPanel.tsx       # Real-time Firestore annotation listener
│   │   ├── TwoColumnTranscript.tsx   # Side-by-side EN/JP transcript columns
│   │   ├── ScreenShareManager.tsx    # Screen capture frame streaming
│   │   └── ...
│   ├── hooks/
│   │   ├── useWebSocket.ts           # Streaming WebSocket hook
│   │   ├── useVisualNounWebSocket.ts # Visual noun WebSocket hook
│   │   ├── useTranslations.ts        # Firestore real-time listener
│   │   └── useConversationHistory.ts # REST API conversation history
│   └── lib/
│       ├── firebase.ts     # Firebase client init
│       └── config.ts       # Service URL configuration
│
└── public/
    └── audio-recorder.js   # AudioWorklet processor (16kHz PCM + bandpass VAD)
```

---

## 🔧 Technical Highlights

### ADK Streaming Architecture
- **Bidirectional streaming** via `LiveRequestQueue` + `runner.run_live()` with concurrent upstream/downstream `asyncio.TaskGroup` tasks
- **Context window compression** (`trigger_tokens=120000`, `sliding_window=60000`) for extended screen-sharing sessions
- **Session resumption** for automatic reconnection on Gemini Live API connection drops (up to 5 retries with exponential backoff)
- **Multimodal input** — audio (PCM 16kHz), document frames (JPEG), and screen captures streamed as `types.Blob` via `send_realtime()`

### Audio Pipeline
- **AudioWorklet processor** running at 16kHz with bandpass filter (300Hz–3500Hz Butterworth biquad) for speech-band RMS energy detection
- **Adaptive noise floor** with calibration phase (~800ms warmup) and continuous adaptation during silence
- **Client-side playback** at 24kHz using Web Audio API with scheduled `AudioBufferSourceNode` queue and precise `nextStartTime` tracking for gapless playback
- **Barge-in support** — interrupt detection immediately stops all queued playback nodes

### Tool Integration
- **`save_translation`** — persists text translations to Firestore, rendered in the annotation panel via `onSnapshot` real-time listener
- **`translate_page` / `translate_selection`** — uses Gemini 3.1 Flash Image to edit document images (replacing text with translations while preserving layout), uploads to GCS, and stores references in Firestore
- **`show_visual_noun`** — `NonBlockingFunctionTool` that generates contextual images via Gemini image generation without interrupting the voice translation stream

### Infrastructure (Terraform)
- Full IaC with Terraform: Cloud Run services, Artifact Registry, IAM roles, Secret Manager
- Dedicated service account with least-privilege access (Firestore, GCS, Secret Manager, Firebase Auth)
- WebSocket services configured with 1-hour timeout for long streaming sessions

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- Firebase project (Auth + Firestore + Storage)
- Google Cloud project with Gemini API access
- `gcloud auth application-default login`

### 1. Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: GOOGLE_CLOUD_PROJECT, GCS_BUCKET, GOOGLE_API_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Fill in: Firebase config, API URLs
```

### 2. Run Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### 3. Run Backend (Local)

```bash
cd backend
pip install -r api/requirements.txt -r streaming/requirements.txt -r visual_noun/requirements.txt

# Terminal 1 — API Service
PYTHONPATH=. uvicorn api.app.main:app --port 8001 --reload

# Terminal 2 — Streaming Service
PYTHONPATH=. uvicorn streaming.app.main:app --port 8002 --reload

# Terminal 3 — Visual Noun Service
PYTHONPATH=. uvicorn visual_noun.app.main:app --port 8003 --reload
```

### 4. Run Backend (Docker)

```bash
cd backend
docker compose up --build
# API: 8001, Streaming: 8002, Visual Noun: 8003
```

### 5. Deploy to GCP (Terraform)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in your values

terraform init
terraform apply
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI Framework** | Google ADK (Agent Development Kit) |
| **LLM** | Gemini 2.5 Flash Native Audio, Gemini 3.1 Flash Image |
| **Backend** | Python, FastAPI, WebSocket, asyncio |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Database** | Cloud Firestore (real-time listeners) |
| **Storage** | Google Cloud Storage (signed URLs) |
| **Auth** | Firebase Authentication (anonymous) |
| **Hosting** | Firebase App Hosting (frontend), Cloud Run (backend) |
| **IaC** | Terraform |
| **Containers** | Docker, Docker Compose |

---

## 📝 Gemini Models Used

| Model | Purpose |
|---|---|
| `gemini-2.5-flash-native-audio-preview` | Real-time voice conversation (both services) |
| `gemini-3.1-flash-image-preview` | Document image translation (layout-preserving text replacement) |
| `gemini-2.5-flash-image` | Visual noun image generation |

---

## 👤 Author

**Chong Zhen Yang**
- GitHub: [@zhenyang0405](https://github.com/zhenyang0405)
- LinkedIn: [chongzhenyang0405](https://linkedin.com/in/chongzhenyang0405)

Built solo for the **Devpost Gemini Live Agent Challenge**.

---

## 📄 License

This project is open source under the [MIT License](LICENSE).
