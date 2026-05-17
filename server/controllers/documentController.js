import multer from 'multer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getVectorStore, embeddings } from '../configs/vectorStore.js';
import Document from '../models/Document.js';
import mongoose from 'mongoose';
import ai from '../configs/ai.js';
import dns from 'dns/promises';
import net from 'net';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MULTER — memory storage (we embed and discard, no disk writes)             */
/* ─────────────────────────────────────────────────────────────────────────── */

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  TEXT EXTRACTION                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

/* OCR via Gemini — reads scanned PDFs and photos of pages natively.
   Tried across a few models so a quota limit on one doesn't break it. */
const OCR_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

async function ocrWithGemini(buffer, mimeType) {
  const instruction =
    'Extract ALL readable text from this file, in natural reading order. ' +
    'It may be a scanned document or a photo of book pages — read the text from the images. ' +
    'Preserve paragraphs and headings. Do NOT summarise or add commentary — ' +
    'output only the raw extracted text.';

  let lastError;
  for (const model of OCR_MODELS) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: instruction },
        ],
      });
      const text = (resp?.text || '').trim();
      if (text) return text;
    } catch (err) {
      lastError = err;
      console.error(`OCR model "${model}" failed:`, err.message);
    }
  }
  throw new Error('Could not read text from this file. ' + (lastError?.message || ''));
}

async function extractText(file) {
  const mime = file.mimetype;

  if (mime === 'application/pdf') {
    let text = '';
    try {
      const data = await pdfParse(file.buffer);
      text = (data.text || '').trim();
    } catch {
      text = '';
    }
    // A scanned / image-only PDF yields little or no extractable text —
    // fall back to Gemini OCR which reads the page images directly.
    if (text.length < 100) {
      console.log('📄 PDF has little embedded text — running OCR...');
      text = await ocrWithGemini(file.buffer, 'application/pdf');
    }
    return { text, fileType: 'pdf' };
  }

  if (mime === 'text/plain') {
    return { text: file.buffer.toString('utf-8'), fileType: 'txt' };
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { text: result.value, fileType: 'docx' };
  }

  if (mime.startsWith('image/')) {
    const text = await ocrWithGemini(file.buffer, mime);
    return { text, fileType: 'image' };
  }

  throw new Error('Unsupported file type');
}

/* SSRF guard — reject URLs that resolve to private/internal addresses so the
   URL-ingestion feature can't be used to reach localhost, the LAN, or cloud
   metadata endpoints (e.g. 169.254.169.254). */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return (
      p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||   // CGNAT
      (p[0] === 169 && p[1] === 254) ||                // link-local / metadata
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      p[0] >= 224                                      // multicast / reserved
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::1' || v6 === '::' ||
    v6.startsWith('fc') || v6.startsWith('fd') ||      // unique-local
    v6.startsWith('fe80') ||                           // link-local
    v6.startsWith('::ffff:')                           // IPv4-mapped
  );
}

async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }
  const host = parsed.hostname.toLowerCase();
  if (/^(localhost|.*\.local|.*\.internal)$/.test(host)) {
    throw new Error('That URL is not allowed');
  }
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Could not resolve that URL');
  }
  if (addresses.some(a => isPrivateAddress(a.address))) {
    throw new Error('That URL points to a private network and is not allowed');
  }
}

async function extractFromUrl(url) {
  await assertSafeUrl(url);
  const { data } = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 3,
    maxContentLength: 10 * 1024 * 1024, // cap fetched page size at 10 MB
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Prompto/1.0)' },
    beforeRedirect: (options) => {
      // Re-check every redirect hop so a benign URL can't bounce to an internal one.
      const h = String(options.hostname || options.host || '').toLowerCase();
      if (
        /^(localhost|.*\.local|.*\.internal)$/.test(h) ||
        (net.isIP(h) && isPrivateAddress(h))
      ) {
        throw new Error('Redirect to a private network is not allowed');
      }
    },
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
    chunkSize: 1200,
    chunkOverlap: 250,
  });

  const chunks = await splitter.createDocuments(
    [text],
    [{ ...metadata, documentId: documentId.toString() }]
  );

  // Embed in small batches with retry/backoff. A large document can exceed
  // the embedding API's rate limit — without this, failed chunks were
  // silently stored with an empty embedding and became unsearchable forever.
  const BATCH_SIZE = 25;
  const docsToStore = [];
  const vectorsToStore = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.pageContent);

    let vectors;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        vectors = await embeddings.embedDocuments(texts);
        break;
      } catch (err) {
        if (attempt === 3) {
          throw new Error('Embedding service is rate-limited right now. Please try again shortly.');
        }
        await new Promise(r => setTimeout(r, attempt * 2500)); // backoff
      }
    }

    // Keep only chunks that actually received a valid embedding vector.
    batch.forEach((doc, j) => {
      const v = vectors[j];
      if (Array.isArray(v) && v.length > 0) {
        docsToStore.push(doc);
        vectorsToStore.push(v);
      }
    });
  }

  if (vectorsToStore.length === 0) {
    throw new Error('Could not embed this document. Please try again.');
  }

  const vectorStore = getVectorStore();
  await vectorStore.addVectors(vectorsToStore, docsToStore);

  return vectorsToStore.length; // the REAL number of searchable chunks
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  UPLOAD DOCUMENT                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export const uploadDocument = async (req, res) => {
  try {
    const userId = req.user?._id;
    // Only the configured admin may publish to the shared "global" pool.
    // Otherwise any user could upload poisoned content that pollutes every
    // user's Study AI global/hybrid results. Non-admin global requests are
    // silently treated as personal documents.
    const wantsGlobal = req.body.isGlobal === 'true' || req.body.isGlobal === true;
    const isAdmin = !!process.env.ADMIN_EMAIL && req.user?.email === process.env.ADMIN_EMAIL;
    const isGlobal = wantsGlobal && isAdmin;
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
    // Show the user's own documents plus any shared/global documents.
    const docs = await Document.find({ $or: [{ userId }, { isGlobal: true }] })
      .sort({ createdAt: -1 })
      .lean();
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

    // A user can delete their own documents or any shared/global document.
    const doc = await Document.findOne({ _id: id, $or: [{ userId }, { isGlobal: true }] });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Delete chunks from vector store collection directly.
    // @langchain/mongodb stores metadata fields flat at the top level.
    const collection = mongoose.connection.db.collection('document_chunks');
    await collection.deleteMany({ documentId: id.toString() });

    await doc.deleteOne();

    return res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
