import multer from 'multer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getVectorStore } from '../configs/vectorStore.js';
import Document from '../models/Document.js';
import mongoose from 'mongoose';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MULTER — memory storage (we embed and discard, no disk writes)             */
/* ─────────────────────────────────────────────────────────────────────────── */

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  TEXT EXTRACTION                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

async function extractText(file) {
  const mime = file.mimetype;

  if (mime === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    return { text: data.text, fileType: 'pdf' };
  }

  if (mime === 'text/plain') {
    return { text: file.buffer.toString('utf-8'), fileType: 'txt' };
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { text: result.value, fileType: 'docx' };
  }

  throw new Error('Unsupported file type');
}

async function extractFromUrl(url) {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Prompto/1.0)' },
  });
  const $ = cheerio.load(data);
  $('script, style, nav, footer, header, aside').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return { text, fileType: 'url' };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CHUNK + EMBED + STORE                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

async function embedAndStore({ text, metadata, documentId }) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.createDocuments(
    [text],
    [{ ...metadata, documentId: documentId.toString() }]
  );

  const vectorStore = getVectorStore();
  await vectorStore.addDocuments(chunks);

  return chunks.length;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  UPLOAD DOCUMENT                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export const uploadDocument = async (req, res) => {
  try {
    const userId = req.user?._id;
    const isGlobal = req.body.isGlobal === 'true';
    const sourceUrl = req.body.url?.trim();

    let text, fileType, fileName;

    if (sourceUrl) {
      // URL ingestion
      ({ text, fileType } = await extractFromUrl(sourceUrl));
      fileName = sourceUrl.length > 60 ? sourceUrl.substring(0, 60) + '...' : sourceUrl;
    } else if (req.file) {
      ({ text, fileType } = await extractText(req.file));
      fileName = req.file.originalname;
    } else {
      return res.status(400).json({ success: false, message: 'Provide a file or URL' });
    }

    if (!text?.trim()) {
      return res.status(422).json({ success: false, message: 'Could not extract text from this source' });
    }

    // Save document record first so we have an ID for chunk metadata
    const doc = await Document.create({
      userId: isGlobal ? null : userId,
      fileName,
      fileType,
      sourceUrl: sourceUrl || null,
      isGlobal,
    });

    const metadata = {
      userId: isGlobal ? null : userId.toString(),
      isGlobal,
      fileName,
      fileType,
    };

    const chunkCount = await embedAndStore({ text, metadata, documentId: doc._id });

    doc.chunkCount = chunkCount;
    await doc.save();

    return res.status(201).json({
      success: true,
      message: `"${fileName}" embedded (${chunkCount} chunks)`,
      document: {
        _id: doc._id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        chunkCount,
        isGlobal,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error('Document upload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LIST USER'S DOCUMENTS                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export const listDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const docs = await Document.find({ userId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, documents: docs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DELETE DOCUMENT + its chunks from vector store                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export const deleteDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const doc = await Document.findOne({ _id: id, userId });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Delete chunks from vector store collection directly
    const collection = mongoose.connection.db.collection('document_chunks');
    await collection.deleteMany({ 'metadata.documentId': id.toString() });

    await doc.deleteOne();

    return res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
