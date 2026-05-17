import express from 'express';
import {
  createChat,
  deleteChat,
  getChat,
  getChats,
  renameChat,
} from '../controllers/chatController.js';
import { protect } from '../middlewares/auth.js';

const chatRouter = express.Router();

chatRouter.get('/create', protect, createChat);
chatRouter.get('/get', protect, getChats);
chatRouter.post('/delete', protect, deleteChat);
chatRouter.post('/rename', protect, renameChat);
// Keep the `/:id` param route last so it doesn't shadow the static routes above.
chatRouter.get('/:id', protect, getChat);

export default chatRouter;
