from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="Prompto AI Service", version="1.0.0")

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-pro",
]

CHAT_SYSTEM = (
    "You are Prompto, a friendly AI assistant. "
    "Never mention Gemini. Keep answers concise and helpful."
)

# ─── Request / Response models ────────────────────────────────────────────────

class Message(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    prompt: str
    history: Optional[List[Message]] = []

class RagRequest(BaseModel):
    prompt: str
    rag_mode: str = "hybrid"
    user_id: str
    history: Optional[List[Message]] = []

class ChatResponse(BaseModel):
    response: str

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "Prompto AI Service is running"}

# ─── /chat — text generation with cascading model fallback ───────────────────

@app.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    # Build multi-turn contents with full conversation history
    contents = []
    for msg in body.history:
        role = "model" if msg.role == "assistant" else "user"
        contents.append(
            types.Content(role=role, parts=[types.Part(text=msg.content)])
        )
    contents.append(
        types.Content(role="user", parts=[types.Part(text=body.prompt)])
    )

    config = types.GenerateContentConfig(system_instruction=CHAT_SYSTEM)

    last_error = None
    for model_id in GEMINI_MODELS:
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=config,
            )
            text = response.text.strip() if response.text else ""
            if text:
                return {"response": text}
        except Exception as e:
            last_error = e
            is_quota = "429" in str(e) or "quota" in str(e).lower()
            print(f"Chat {model_id} failed{'(quota)' if is_quota else ''}: {str(e)[:80]}")

    raise HTTPException(
        status_code=500,
        detail=str(last_error) or "All AI models are currently unavailable",
    )

# ─── /rag — Study AI RAG response ────────────────────────────────────────────

@app.post("/rag", response_model=ChatResponse)
def rag(body: RagRequest):
    from rag_chain import run_rag_chain
    try:
        text = run_rag_chain(
            user_id=body.user_id,
            question=body.prompt,
            rag_mode=body.rag_mode,
            chat_history=body.history,
        )
        return {"response": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
