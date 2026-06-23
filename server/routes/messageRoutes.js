import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  imageMessageController,
  textMessageController,
  videoMessageController,
  ragMessageController,
  regenerateMessageController,
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

// Retry the AI reply for a chat whose last assistant message is `stopped`.
messageRouter.post('/regenerate', protect, regenerateMessageController);

export default messageRouter;
