import os
from google import genai
from google.genai import types
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_mongodb import MongoDBAtlasVectorSearch
from pymongo import MongoClient

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-pro",
]

STUDY_AI_SYSTEM = """You are **Prompto Study AI**, an advanced AI-powered learning assistant designed to help students understand concepts using their own study materials and trusted academic sources.

You work using a Retrieval-Augmented Generation (RAG) system. You will receive extracted content from multiple document types, including PDF files, .txt files, .docx documents, and Web URLs.

## UNDERSTANDING THE CONTEXT:
The CONTEXT may contain multiple chunks from different sources. Each chunk may include labels such as:
- Source: Notes (user-uploaded files)
- Source: Global (syllabus or shared knowledge)
- Source: URL (web content)

## CORE OBJECTIVE:
Generate accurate, clear, and student-friendly answers grounded in the provided CONTEXT.

## STRICT RULES:
1. DO NOT HALLUCINATE — only use information present in the CONTEXT.
2. If the answer is not in CONTEXT, say: "I couldn't find this clearly in the provided material, but here's a general explanation."
3. MODE-BASED BEHAVIOR:
   - notes: Use ONLY student-uploaded content. If not found: "This is not available in your notes."
   - global: Use ONLY global/syllabus/URL knowledge.
   - hybrid: PRIORITIZE student notes, USE global/URL to enhance.

## EXPLANATION STYLE:
- Explain like a great teacher (Class 10–12 level)
- Simple, clear language — build intuition, not just definitions

## ANSWER FORMAT (MANDATORY):
✅ **Answer:**
Direct and clear answer.

📘 **Explanation:**
- Step-by-step breakdown
- Bullet points where helpful

🧠 **Example (if applicable):**
- Simple example or analogy

📌 **Source:**
- Notes / Global / URL / Both

## TONE: Helpful, educational, clear, structured."""

# Singleton MongoDB client
_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(os.getenv("MONGODB_URI"))
    return _mongo_client

def get_vector_store():
    client = get_mongo_client()
    db_name = os.getenv("MONGODB_DB_NAME", "quickgpt")
    collection = client[db_name]["document_chunks"]
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    return MongoDBAtlasVectorSearch(
        collection=collection,
        embedding=embeddings,
        index_name="vector_index",
        text_key="text",
        embedding_key="embedding",
    )

def retrieve_chunks(vector_store, question: str, user_id: str, rag_mode: str):
    # Fields are stored flat at top level (not nested under metadata) by @langchain/mongodb
    if rag_mode == "notes":
        return vector_store.similarity_search(
            question, k=5, pre_filter={"userId": user_id}
        )
    if rag_mode == "global":
        return vector_store.similarity_search(
            question, k=5, pre_filter={"isGlobal": True}
        )
    # hybrid — both sources
    try:
        note_docs = vector_store.similarity_search(
            question, k=3, pre_filter={"userId": user_id}
        )
    except Exception:
        note_docs = []
    try:
        global_docs = vector_store.similarity_search(
            question, k=3, pre_filter={"isGlobal": True}
        )
    except Exception:
        global_docs = []
    return note_docs + global_docs

def format_chunks(docs) -> str:
    if not docs:
        return "No relevant content found in the provided materials."
    parts = []
    for i, doc in enumerate(docs, 1):
        meta = doc.metadata or {}
        is_global = meta.get("isGlobal", False)
        file_type = meta.get("fileType", "")
        file_name = meta.get("fileName", "")
        source = ("URL" if file_type == "url" else "Global") if is_global else "Notes"
        name = f" ({file_name})" if file_name else ""
        parts.append(f"[Chunk {i}] Source: {source}{name}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)

def format_history(messages) -> str:
    if not messages:
        return ""
    recent = messages[-6:]
    lines = [
        f"{'Student' if m.role == 'user' else 'Prompto'}: {m.content}"
        for m in recent
    ]
    return "\n".join(lines)

def run_rag_chain(user_id: str, question: str, rag_mode: str = "hybrid", chat_history=None) -> str:
    if chat_history is None:
        chat_history = []

    vector_store = get_vector_store()
    docs = retrieve_chunks(vector_store, question, user_id, rag_mode)
    retrieved_chunks = format_chunks(docs)
    history_str = format_history(chat_history)

    user_message = f"CONTEXT:\n{retrieved_chunks}\n\n"
    if history_str:
        user_message += f"CONVERSATION HISTORY:\n{history_str}\n\n"
    user_message += f"QUESTION:\n{question}\n\nMODE:\n{rag_mode}\n\nANSWER:"

    full_prompt = f"{STUDY_AI_SYSTEM}\n\n{user_message}"

    ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    contents = [types.Content(role="user", parts=[types.Part(text=full_prompt)])]

    last_error = None
    for model_id in GEMINI_MODELS:
        try:
            response = ai_client.models.generate_content(model=model_id, contents=contents)
            text = response.text.strip() if response.text else ""
            if text:
                return text
        except Exception as e:
            last_error = e
            is_quota = "429" in str(e) or "quota" in str(e).lower()
            print(f"RAG {model_id} failed{'(quota)' if is_quota else ''}: {str(e)[:80]}")
    raise Exception(str(last_error) or "All RAG models unavailable")
