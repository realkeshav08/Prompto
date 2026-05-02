import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import mongoose from 'mongoose';

// gemini-embedding-001 produces 3072-dimensional vectors
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'models/gemini-embedding-001',
});

export function getVectorStore() {
  const collection = mongoose.connection.db.collection('document_chunks');

  return new MongoDBAtlasVectorSearch(embeddings, {
    collection,
    indexName: 'vector_index',   // must match the Atlas index name you create
    textKey: 'text',
    embeddingKey: 'embedding',
  });
}

export { embeddings };

/*
  SETUP REQUIRED IN MongoDB Atlas:
  ─────────────────────────────────────────────────────────────
  Create a Vector Search index named "vector_index" on the
  "document_chunks" collection with the following definition:

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
  ─────────────────────────────────────────────────────────────
*/
