import express from 'express';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { documentSchemas } from '../validators/schemas.js';
import {
  upload,
  uploadDocument,
  listDocuments,
  deleteDocument,
} from '../controllers/documentController.js';

const documentRouter = express.Router();

// POST /api/document/upload — file (multipart) OR { url } body
documentRouter.post('/upload', protect, upload.single('file'), validate(documentSchemas.upload), uploadDocument);

// GET /api/document/list — user's uploaded documents
documentRouter.get('/list', protect, listDocuments);

// DELETE /api/document/:id
documentRouter.delete('/:id', protect, validate(documentSchemas.remove), deleteDocument);

export default documentRouter;
