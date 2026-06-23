import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';

import connectDB from './configs/db.js';
import { logger } from './configs/logger.js';
import { limiterStore, redisClient } from './configs/rateLimit.js';
import userRouter from './routes/userRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import creditRouter from './routes/creditRoutes.js';
import documentRouter from './routes/documentRoutes.js';
import { stripeWebhooks } from './controllers/webhooks.js';

const app = express();

// Optional error tracking — enabled only when SENTRY_DSN is set AND the package
// is installed, so it stays a zero-cost opt-in for deployments that don't use it.
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = await import('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    logger.info('Sentry error tracking enabled');
  } catch {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed — skipping Sentry');
  }
}

// Trust the first proxy hop (Vercel/Render/etc.) so rate limiting keys on the
// real client IP rather than the proxy's.
app.set('trust proxy', 1);

// Structured request logging with a generated request id per request, so the
// log lines for one request can be correlated. Mounted before everything else.
app.use(pinoHttp({ logger }));

/* ---------------- DATABASE ---------------- */

try {
  await connectDB();
} catch (err) {
  logger.error({ err: err.message }, 'Failed to connect to database');
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
].filter(Boolean);                // drop undefined entries (e.g. CLIENT_URL unset)

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
// Clients only ever POST small JSON (prompts are capped at 5000 chars; file
// uploads go through multipart/multer, not here), so keep the JSON body small
// to limit memory pressure and payload-based abuse.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ---------------- RATE LIMITING ---------------- */

// Strict limiter for auth + password endpoints — blocks credential and
// OTP brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore('rl:auth:'),
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// General limiter for the rest of the API.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore('rl:api:'),
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Stricter limiter for AI generation endpoints — caps Gemini/image cost and
// abuse. These are the expensive, credit-spending routes.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore('rl:ai:'),
  message: { success: false, message: 'Too many AI requests. Please try again later.' },
});

// Document ingestion runs expensive Gemini OCR + embedding work, so cap it
// tightly and separately from the general API limiter.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore('rl:upload:'),
  message: { success: false, message: 'Too many uploads. Please try again later.' },
});

app.use(
  [
    '/api/user/login',
    '/api/user/register',
    '/api/user/forgot-password',
    '/api/user/verify-otp',
    '/api/user/reset-password',
    '/api/user/change-password',
    '/api/user/verify-email',
    '/api/user/resend-verification',
  ],
  authLimiter
);
app.use('/api/message', aiLimiter);
app.use('/api/document/upload', uploadLimiter);
app.use('/api', apiLimiter);

/* ---------------- ROUTES ---------------- */

app.get('/', (_req, res) => {
  res.send('✅ Prompto API is live');
});

// Health probe for the load balancer / PM2 / uptime checks. Reports degraded
// when the database connection isn't ready so traffic can be routed away.
app.get('/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    db: dbReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
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

app.use((err, req, res, _next) => {
  // req.log carries the per-request id from pino-http for correlation.
  (req.log || logger).error({ err: err.message, stack: err.stack }, 'Unhandled error');
  if (Sentry) Sentry.captureException(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

/* ---------------- GRACEFUL SHUTDOWN ----------------
   On a deploy/restart (PM2 sends SIGINT/SIGTERM) stop accepting new
   connections, let in-flight requests finish, then close the DB cleanly.
   A hard ceiling guarantees the process still exits if a request hangs. */

const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      if (redisClient) await redisClient.quit();
    } catch (err) {
      logger.error({ err: err.message }, 'Error during shutdown cleanup');
    }
    process.exit(0);
  });

  // Force-exit if connections don't drain within 10s.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
