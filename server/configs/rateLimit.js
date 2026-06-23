import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { logger } from './logger.js';

/* ─────────────────────────────────────────────────────────────────────────────
   RATE-LIMIT STORE (shared across instances)

   express-rate-limit defaults to an in-process MemoryStore, which means each
   worker/instance counts independently — under PM2 cluster mode or multiple
   replicas the real limit is multiplied, and counters reset on every restart.

   When REDIS_URL is configured we back the limiters with Redis so the limit is
   enforced globally and survives restarts. With REDIS_URL unset, limiterStore()
   returns undefined and express-rate-limit keeps its built-in MemoryStore — so
   single-instance deployments need zero extra infrastructure.
   ───────────────────────────────────────────────────────────────────────── */

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', (err) => logger.error({ err: err.message }, 'Redis client error'));
  redisClient
    .connect()
    .then(() => logger.info('Redis connected — rate limiting is now shared across instances'))
    .catch((err) => {
      logger.error({ err: err.message }, 'Redis connection failed — falling back to in-memory rate limiting');
      redisClient = null;
    });
}

/* Returns a per-limiter store. `prefix` namespaces each limiter's keys so the
   auth, api, ai and upload limiters don't share counters. Returns undefined
   (⇒ MemoryStore) when Redis isn't configured. */
export function limiterStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

export { redisClient };
