import express from 'express';
import 'dotenv/config';
import cors from 'cors';

import connectDB from './configs/db.js';
import userRouter from './routes/userRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import creditRouter from './routes/creditRoutes.js';
import { stripeWebhooks } from './controllers/webhooks.js';

const app = express();

/* ---------------- DATABASE ---------------- */

try {
  await connectDB();
} catch (err) {
  console.error('❌ Failed to connect to database');
  process.exit(1);
}

/* ---------------- STRIPE WEBHOOK ---------------- */
/* MUST come before express.json() */
app.post(
  '/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhooks
);

/* ---------------- MIDDLEWARE ---------------- */

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());

/* ---------------- ROUTES ---------------- */

app.get('/', (_req, res) => {
  res.send('✅ Prompto API is live');
});

app.use('/api/user', userRouter);
app.use('/api/chat', chatRouter);
app.use('/api/message', messageRouter);
app.use('/api/credit', creditRouter);

/* ---------------- 404 HANDLER ---------------- */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
