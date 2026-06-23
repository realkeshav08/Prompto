import pino from 'pino';

/* ─────────────────────────────────────────────────────────────────────────────
   STRUCTURED LOGGER

   A single pino instance for the whole server. Emits one JSON object per log
   line — parseable by log aggregators (Datadog, Loki, CloudWatch, etc.) and far
   more useful in production than free-text console output. Level is controlled
   by LOG_LEVEL (default "info"). Paired with pino-http in server.js, every
   request gets a generated id so related log lines can be correlated.
   ───────────────────────────────────────────────────────────────────────── */

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // drop pid/hostname noise; the platform already adds these
  redact: {
    // Never log credentials or tokens even if an object carrying them is logged.
    paths: ['req.headers.authorization', 'password', '*.password', 'token', '*.token'],
    remove: true,
  },
});
