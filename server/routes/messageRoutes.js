import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  imageMessageController,
  textMessageController,
  videoMessageController,
  ragMessageController,
} from '../controllers/messageController.js';

const messageRouter = express.Router();

/* ---------------- MESSAGES ---------------- */

// Text-based AI message
messageRouter.post('/text', protect, textMessageController);

// Image generation message
messageRouter.post('/image', protect, imageMessageController);

// Video generation message
messageRouter.post('/video', protect, videoMessageController);

// Study AI — RAG-powered response
messageRouter.post('/rag', protect, ragMessageController);

export default messageRouter;
