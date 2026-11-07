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
    /* Credentials must never reach disk. The cookie entries matter most: the
       session JWT travels as an httpOnly cookie, so pino-http's request/response
       header dumps would otherwise write a live 30-day token into the log on
       every authenticated call — readable by anyone with log or backup access,
       which undoes the reason the token was moved out of localStorage. */
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-internal-key"]',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'token',
      '*.token',
    ],
    remove: true,
  },
});
