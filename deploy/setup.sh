#!/usr/bin/env bash
#
# One-shot provisioner for the Prompto backend + Python AI service on a fresh
# Ubuntu (22.04/24.04) Azure VM. Safe to re-run — every step is idempotent.
#
# Usage (as the VM admin user you created, NOT root):
#   export REPO_URL="https://github.com/realkeshav08/Prompto.git"   # or your SSH URL
#   bash deploy/setup.sh
#
# It will PAUSE after installing deps if the two .env files are missing, so you
# can fill in secrets, then you re-run it to start the services.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/realkeshav08/Prompto.git}"
APP_DIR="${APP_DIR:-$HOME/apps/Prompto}"
NODE_MAJOR=22

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }

# ── 1. Base packages ─────────────────────────────────────────────────────────
log "Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential nginx redis-server \
     python3 python3-venv python3-pip ufw

# ── 2. Swap (protects a 1 GB VM from OOM kills under Node+Python) ─────────────
if ! sudo swapon --show | grep -q '/swapfile'; then
  log "Creating 2 GB swap file"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  log "Swap already present — skipping"
fi

# ── 3. Node 22 + pnpm + pm2 ──────────────────────────────────────────────────
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
  log "Installing Node $NODE_MAJOR (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
log "Enabling pnpm (corepack) and pm2"
sudo corepack enable
command -v pm2 >/dev/null || sudo npm install -g pm2

# ── 4. Get / update the code ─────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  log "Cloning $REPO_URL -> $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Repo exists — pulling latest"
  git -C "$APP_DIR" pull --ff-only
fi
cd "$APP_DIR"

# ── 5. Install dependencies ──────────────────────────────────────────────────
log "Installing backend (Node) dependencies"
( cd server && pnpm install --prod )

log "Setting up Python venv + dependencies"
if [ ! -d python-service/venv ]; then
  python3 -m venv python-service/venv
fi
python-service/venv/bin/pip install --upgrade pip
python-service/venv/bin/pip install -r python-service/requirements.txt

# ── 6. Environment files (secrets — you fill these in) ───────────────────────
MISSING_ENV=0
for svc in server python-service; do
  if [ ! -f "$svc/.env" ]; then
    cp "$svc/.env.example" "$svc/.env"
    warn "Created $svc/.env from the example — EDIT IT with real values."
    MISSING_ENV=1
  fi
done
if [ "$MISSING_ENV" -eq 1 ]; then
  warn "Fill in both .env files (nano server/.env  and  nano python-service/.env),"
  warn "then re-run:  bash deploy/setup.sh   to start the services."
  exit 0
fi

# ── 7. Start / reload services with PM2 ──────────────────────────────────────
log "Starting services with PM2"
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save
# Make PM2 resurrect on reboot (prints a sudo command the first time only).
pm2 startup systemd -u "$USER" --hp "$HOME" | grep -E '^sudo' | bash || true

# ── 8. Nginx site (SSL added later by certbot) ───────────────────────────────
log "Installing nginx site config"
sudo cp deploy/nginx/prompto-api.conf /etc/nginx/sites-available/prompto-api
sudo ln -sf /etc/nginx/sites-available/prompto-api /etc/nginx/sites-enabled/prompto-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

log "Done. Next: point DNS at this VM, then run certbot (see deploy/AZURE_DEPLOY.md)."
pm2 status
