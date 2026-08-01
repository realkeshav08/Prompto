# Prompto

A full-stack AI study workspace: chat, image generation, and a RAG pipeline that
answers questions from your own documents. Credit-based, with Stripe billing.

**[Live](https://prompto.keshavkashyap.me)** · [Frontend on Vercel, services on a single VPS]

---

## What it does

- **Chat** — conversational replies with a bounded window of recent history.
- **Study AI (RAG)** — upload PDF, DOCX, TXT, images or a URL, then ask questions
  grounded in that material. Scanned PDFs and photos are read with OCR. You choose
  whether to search your own notes, a shared library, or both.
- **Image generation** — falls through a cascade of free providers so one being
  rate-limited doesn't break the feature.
- **Credits** — 1 for chat, 2 for Study AI, 2 for an image. New accounts get 100.
  A failed generation refunds automatically.
- **Accounts** — email-verified signup, OTP password recovery, session revocation.

A failed reply is saved as a "Stopped" placeholder rather than lost, and can be
regenerated in one click.

---

## Architecture

```
React SPA  →  Node/Express API  →  Python FastAPI (localhost only)
                     ↓                        ↓
                 MongoDB                  Gemini API
                     ↓
          Atlas Vector Search
```

The Node API owns auth, credits and persistence. All model calls go through the
Python service, which binds to `127.0.0.1` and requires a shared secret — so it
has no public surface, and an AI outage degrades one feature instead of the app.

**Stack:** React 19 · Vite · Tailwind 4 · Express 5 · MongoDB · FastAPI ·
Gemini · LangChain · Stripe · Nginx · PM2

---

## Running locally

Needs Node 20+, Python 3.10+, a MongoDB Atlas cluster, and Gemini/Stripe/ImageKit
keys. Each service has a `.env.example` to copy.

```bash
# Python AI service
cd python-service
python -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env
./venv/bin/uvicorn main:app --port 8000

# Node API
cd server && pnpm install && cp .env.example .env && pnpm dev

# React client
cd client && npm install && cp .env.example .env && npm run dev
```

Open http://localhost:5173

> `INTERNAL_API_KEY` must be identical in `server/.env` and
> `python-service/.env` — it's what lets the AI service reject any caller other
> than the Node API.

Email sends through [Resend](https://resend.com) over HTTPS. Without
`RESEND_API_KEY` it falls back to SMTP, which is fine locally but blocked on most
cloud hosts.

### Atlas vector index

Create a Vector Search index named `vector_index` on `document_chunks`:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 3072, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "isGlobal" }
  ]
}
```

The dimension has to match the embedding model (`gemini-embedding-001`) on both
the Node ingestion path and the Python retrieval path.

---

## Notes on the implementation

Things that were less obvious than they looked:

- **Credits are decremented atomically** — the balance check lives inside the
  update filter, so two concurrent requests can't both pass it.
- **The Stripe webhook is exactly-once.** It claims the transaction with a
  compare-and-set before crediting, so a retry is a no-op rather than a second
  credit.
- **Retrieval is filtered per user** at the vector-search level, not after the
  fact, so one tenant's documents can't surface in another's answers.
- **Retrieved chunks are fenced** with a random per-request marker and stripped
  of invisible characters, so text inside a document can't pose as an
  instruction.
- **URL ingestion is SSRF-guarded** — private, loopback and cloud-metadata
  addresses are rejected, and every redirect hop is re-checked.
- Requests are validated by Zod schemas before reaching a handler; declaring
  fields as strings is also what stops MongoDB operators being smuggled into a
  query.

---

## Deploying

Both backend services run on one VPS under PM2, behind Nginx with a Let's
Encrypt certificate and Cloudflare in front. The frontend deploys to Vercel.

See [`deploy/AZURE_DEPLOY.md`](deploy/AZURE_DEPLOY.md) for a step-by-step setup;
`deploy/setup.sh` provisions a fresh Ubuntu box and is safe to re-run.

Worth knowing: `/health` returns 503 when the database is unreachable, the server
drains in-flight requests on `SIGTERM`, and Atlas Network Access is per-IP — a new
host has to be allowlisted or the API won't start.

---

## Status

Personal project, actively maintained. Test coverage is light and focused on the
parts where a silent regression would be expensive (input validation, SSRF
predicates); the billing path is verified manually.

Created by [realkeshav08](https://github.com/realkeshav08).
