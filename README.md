# Prompto | The Advanced AI Workspace

Prompto is a full-stack AI platform for text generation, image creation, and RAG-powered Study AI. Built with a modern glassmorphic aesthetic and a credit-based billing system.

---

## Features

- **Multi-Modal AI** — Text chat, image generation, video, and Study AI (RAG) modes
- **Study AI** — Upload PDFs, DOCX, TXT files or paste URLs; ask questions grounded in your own materials using Retrieval-Augmented Generation
- **Conversation Memory** — Multi-turn chat history passed to the AI for context-aware responses
- **Credit System** — Stripe-integrated billing with per-feature credit costs and automatic refunds on failure
- **Community Gallery** — Publish and browse AI-generated images
- **Secure Auth** — JWT authentication with bcrypt password hashing and OTP-based password recovery

---

## Tech Stack

### Frontend
- React 19, Vite 8, Tailwind CSS v4
- React Router 7, Axios, React Markdown, React Hot Toast

### Backend (Node.js)
- Express 5, MongoDB + Mongoose
- LangChain (`@langchain/mongodb`, `@langchain/google-genai`) for document ingestion
- ImageKit SDK, Stripe API, Nodemailer

### AI Microservice (Python)
- FastAPI + Uvicorn
- Google Gemini API (`google-genai`) with 7-model cascading fallback
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

The Node.js server handles auth, credits, and data persistence. All AI inference is delegated to the Python microservice.

---

## Getting Started

### Prerequisites
- Node.js v18+
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
| Study AI (RAG) | 1 |
| Image generation | 2 |
| Video generation | 4 |

---

## Production Deployment

- **Frontend + Node.js backend** → Vercel
- **Python microservice** → Railway, Render, or any VPS
- Set `PYTHON_AI_URL` in the server environment to point to your deployed Python service

---

## License

Open-source. Created by [realkeshav08](https://github.com/realkeshav08).
