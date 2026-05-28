# Prompto | The Advanced AI Workspace

Prompto is a full-stack AI platform for text generation, image creation, and
RAG-powered Study AI. Built with a modern glassmorphic aesthetic and a
credit-based billing system.

---

## Features

- **Multi-Modal AI** — Text chat, image generation, and Study AI (RAG) modes. (Video generation is an upcoming feature.)
- **Study AI (RAG)** — Upload PDFs, DOCX, TXT files, **images**, or paste URLs; ask questions grounded in your own materials. Scanned/image-only PDFs and photos are read with **OCR**.
- **AI-generated chat titles** — Each conversation is auto-named from its first exchange; titles are also editable.
- **Conversation memory** — A bounded, recent-context window of the chat history is passed to the model for coherent multi-turn replies.
- **Resilient image generation** — A cascade of free providers (Pollinations → Gemini → ImageKit) so a quota limit on one doesn't break image creation.
- **Credit system** — Stripe-integrated billing with per-feature credit costs and automatic refunds on failure.
- **Community Gallery** — Publish and browse AI-generated images.
- **In-app Settings** — Profile, password change, plan/credits, theme, and Terms / Privacy.
- **Secure auth** — JWT authentication, bcrypt password hashing, and OTP-based password recovery.

---

## Tech Stack

### Frontend
- React 19, Vite 8, Tailwind CSS v4
- React Router 7, Axios, React Markdown, React Hot Toast

### Backend (Node.js)
- Express 5, MongoDB + Mongoose
- LangChain (`@langchain/mongodb`, `@langchain/google-genai`) for document ingestion
- ImageKit SDK, Stripe API, Nodemailer
- `helmet`, `compression`, `express-rate-limit`, `zod` (input validation)

### AI Microservice (Python)
- FastAPI + Uvicorn
- Google Gemini API (`google-genai`) with a multi-model cascading fallback
- LangChain + MongoDB Atlas Vector Search for RAG
- Embedding model: `gemini-embedding-001` (3072 dimensions)

---

## Architecture

```
Client (React) → Node.js API → Python FastAPI
                     ↓               ↓
                  MongoDB        Gemini AI
                     ↓
            MongoDB Atlas Vector Search
```

The Node.js server handles auth, credits, and data persistence. All AI
inference is delegated to the Python microservice.

---

## Getting Started

### Prerequisites
- Node.js v20+
- Python 3.10+
- MongoDB Atlas cluster with a Vector Search index on `document_chunks`
- Gemini API key
- Stripe account
- ImageKit account

### 1. Clone the repo
```bash
git clone https://github.com/realkeshav08/Prompto.git
cd Prompto
```

### 2. Python AI service
```bash
cd python-service
pip install -r requirements.txt
cp .env.example .env   # fill in your values
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Node.js backend
```bash
cd server
npm install
cp .env.example .env   # fill in your values
npm run dev
```

### 4. React frontend
```bash
cd client
npm install
cp .env.example .env   # fill in your values
npm run dev
```

Open **http://localhost:5173**

> **Note:** `INTERNAL_API_KEY` must be set to the **same value** in both
> `server/.env` and `python-service/.env` — it lets the AI service reject any
> caller other than the Node API.

---

## MongoDB Atlas Vector Search Index

Create a Vector Search index named `vector_index` on the `document_chunks` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "isGlobal" }
  ]
}
```

---

## Credit Costs

| Feature | Credits |
|---------|---------|
| Text chat | 1 |
| Study AI (RAG) | 2 |
| Image generation | 2 |
| Video generation | 4 *(upcoming)* |

New accounts start with 100 credits.

---

## Security

- JWT auth with bcrypt-hashed passwords; OTP password recovery.
- Rate limiting on auth/password endpoints (brute-force protection) and stricter
  limits on AI generation endpoints (`/api/message`) to cap cost/abuse.
- Request body size limits and Zod schema validation on message inputs.
- The Python AI service requires an internal shared key (`INTERNAL_API_KEY`) and
  binds to localhost only — it is never publicly exposed.
- URL document ingestion is SSRF-guarded (private/internal addresses blocked).
- Shared "global" Study AI documents can only be uploaded by `ADMIN_EMAIL`.
- AI system prompts are hardened against prompt injection and document poisoning.

---

## Production Deployment

The production stack runs the Node backend and Python service together on a
single VPS, both managed by PM2 (auto-restart on crash/reboot via `pm2 save` +
a systemd startup hook):

- **Frontend** → Vercel — set `VITE_SERVER_URL` to the backend URL.
- **Node.js backend** → VPS, on an internal port (e.g. `3001`) behind an Nginx
  reverse proxy with HTTPS (Let's Encrypt), fronted by Cloudflare. Set
  `CLIENT_URL` (frontend URL) and `PYTHON_AI_URL` (`http://127.0.0.1:8000`).
- **Python microservice** → same VPS, bound to **`127.0.0.1:8000` only** (never
  publicly exposed). Start command `uvicorn main:app --host 127.0.0.1 --port 8000`.
- Set the **same** `INTERNAL_API_KEY` on the backend and the Python service.
- Register the production Stripe webhook at `/api/webhook/stripe`.
- Lock MongoDB Atlas **Network Access** to the VPS IP only.

---

## License

Open-source. Created by [realkeshav08](https://github.com/realkeshav08).
