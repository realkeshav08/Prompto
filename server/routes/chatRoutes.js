import express from 'express';
import {
  createChat,
  deleteChat,
  getChat,
  getChats,
  renameChat,
} from '../controllers/chatController.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { chatSchemas } from '../validators/schemas.js';

const chatRouter = express.Router();

/* POST because it writes: SameSite=Lax sends the auth cookie on top-level
   navigations, so a GET let a third-party page trigger creation, and link
   prefetchers could fire it unintentionally. */
chatRouter.post('/create', protect, createChat);

chatRouter.get('/get', protect, validate(chatSchemas.get), getChats);
chatRouter.post('/delete', protect, validate(chatSchemas.remove), deleteChat);
chatRouter.post('/rename', protect, validate(chatSchemas.rename), renameChat);
// Keep the `/:id` param route last so it doesn't shadow the static routes above.
chatRouter.get('/:id', protect, validate(chatSchemas.byId), getChat);

export default chatRouter;
