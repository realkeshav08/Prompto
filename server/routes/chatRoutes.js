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

/* Creation writes, so it must not be a GET: SameSite=Lax sends the auth cookie
   on top-level navigations, letting a third-party page trigger it, and link
   prefetchers can fire it unintentionally. The GET form is retained only so
   clients still running a cached bundle keep working — drop it next release. */
chatRouter.post('/create', protect, createChat);
chatRouter.get('/create', protect, createChat); // deprecated

chatRouter.get('/get', protect, getChats);
chatRouter.post('/delete', protect, deleteChat);
chatRouter.post('/rename', protect, renameChat);
// Keep the `/:id` param route last so it doesn't shadow the static routes above.
chatRouter.get('/:id', protect, getChat);

export default chatRouter;
