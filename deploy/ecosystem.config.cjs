/*
 * PM2 process definitions for the Prompto backend (Node) and AI service (Python).
 * Run from the repo root:  pm2 start deploy/ecosystem.config.cjs
 *
 * Paths are resolved from this file's location, so it works no matter which
 * directory you launch pm2 from.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const PYTHON_DIR = path.join(ROOT, 'python-service');

module.exports = {
  apps: [
    {
      name: 'prompto-backend',
      cwd: SERVER_DIR,
      script: 'server.js',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      // On a 1 GB VM, restart a leaking worker before it triggers the OOM killer.
      max_memory_restart: '450M',
      time: true,
      autorestart: true,
    },
    {
      name: 'prompto-python',
      cwd: PYTHON_DIR,
      // Run uvicorn straight from the venv so PM2 doesn't need the venv "activated".
      script: path.join(PYTHON_DIR, 'venv', 'bin', 'uvicorn'),
      args: 'main:app --host 127.0.0.1 --port 8000 --workers 1',
      interpreter: 'none',
      max_memory_restart: '600M',
      time: true,
      autorestart: true,
    },
  ],
};
