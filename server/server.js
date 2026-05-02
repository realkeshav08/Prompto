import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import connectDB from './configs/db.js';
import userRouter from './routes/userRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import creditRouter from './routes/creditRoutes.js';
import documentRouter from './routes/documentRoutes.js';
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

app.post(
  '/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhooks
);

/* ---------------- CORS CONFIG ---------------- */

// Add your real Vercel domain here
const allowedOrigins = [
  process.env.CLIENT_URL,         // production frontend
  'http://localhost:5173',        // local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
  })
);

/* ---------------- MIDDLEWARE ---------------- */

app.use(helmet({
  crossOriginResourcePolicy: false, // Required for ImageKit images to load correctly in some browsers
}));
app.use(compression());
app.use(express.json());

/* ---------------- ROUTES ---------------- */

app.get('/', (_req, res) => {
  res.send('✅ Prompto API is live');
});

app.use('/api/user', userRouter);
app.use('/api/chat', chatRouter);
app.use('/api/message', messageRouter);
app.use('/api/credit', creditRouter);
app.use('/api/document', documentRouter);

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
    message: err.message || 'Internal server error',
  });
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
