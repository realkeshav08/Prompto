import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  upload,
  uploadDocument,
  listDocuments,
  deleteDocument,
} from '../controllers/documentController.js';

const documentRouter = express.Router();

// POST /api/document/upload — file (multipart) OR { url } body
documentRouter.post('/upload', protect, upload.single('file'), uploadDocument);

// GET /api/document/list — user's uploaded documents
documentRouter.get('/list', protect, listDocuments);

// DELETE /api/document/:id
documentRouter.delete('/:id', protect, deleteDocument);

export default documentRouter;
