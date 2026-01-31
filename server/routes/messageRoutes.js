import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  imageMessageController,
  textMessageController,
} from '../controllers/messageController.js';

const messageRouter = express.Router();

/* ---------------- MESSAGES ---------------- */

// Text-based AI message
messageRouter.post('/text', protect, textMessageController);

// Image generation message
messageRouter.post('/image', protect, imageMessageController);

export default messageRouter;
