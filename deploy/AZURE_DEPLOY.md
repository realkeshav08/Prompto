# Deploying Prompto (backend + Python AI service) to a single Azure VM

A lift-and-shift of the DigitalOcean setup onto one Azure Linux VM:
**Nginx (SSL) → Node backend `:3001`**, with the **Python AI service private on
`127.0.0.1:8000`** and **Redis local on `:6379`**. MongoDB Atlas and Gemini stay
external. Frontend stays on Vercel.

Legend: 👤 = you do it (Azure portal / DNS / secrets) · 🤖 = the `setup.sh` script does it.

---

## 0. Before you start
- Keep credits alive: **B1s** VM (1 vCPU / 1 GB) + a 2 GB swap file (the script
  adds it) is ~\$8/mo → your \$100 student credit lasts ~12 months. Bump to
  **B1ms** (2 GB) later if you see the Python service getting OOM-restarted.
- Have ready: MongoDB Atlas URI, Gemini API key, ImageKit keys, Stripe keys,
  Gmail app password, and a strong `INTERNAL_API_KEY` (same string in both services).

---

## 1. 👤 Create the VM (Azure portal → *Virtual machines* → *Create*)
- **Image:** Ubuntu Server 24.04 LTS · **Size:** B1s · **Architecture:** x64
- **Region:** Central India (low latency to you + Atlas; keep Atlas in the same/near region)
- **Authentication:** SSH public key · **Username:** e.g. `keshav` (remember it)
- **Disk:** 30 GB Standard SSD
- **Public IP:** create new, **SKU Standard**, **Assignment Static** (so DNS never breaks)
- Download / save the SSH private key when prompted.

## 2. 👤 Open only the ports you need (VM → *Networking* → inbound rules)
Allow **22 (SSH)**, **80 (HTTP)**, **443 (HTTPS)**.
**Do NOT open 3001, 8000, or 6379** — those stay internal. (Tip: restrict 22's
source to *My IP* for safety.)

## 3. 👤 Whitelist the VM in MongoDB Atlas
Atlas → *Network Access* → *Add IP Address* → paste the VM's **public IP**.
(Without this the backend and Python service can't reach the database.)

## 4. 👤 Point DNS at the VM
Add/repoint an **A record** for your API subdomain (e.g.
`prompto-api.keshavkashyap.me`) → the VM's public IP.
**Cloudflare users:** set it to **DNS only (grey cloud)** for now — you'll flip it
back to proxied after the SSL cert is issued (step 7).

## 5. 👤 SSH in and run the provisioner
```bash
ssh -i /path/to/key.pem keshav@<VM_PUBLIC_IP>

# on the VM:
export REPO_URL="https://github.com/realkeshav08/Prompto.git"   # SSH URL if private
curl -fsSL https://raw.githubusercontent.com/realkeshav08/Prompto/main/deploy/setup.sh -o setup.sh
# (or: git clone the repo first, then `bash deploy/setup.sh`)
bash setup.sh
```
🤖 The script installs Node 22, pnpm, PM2, Python venv, Redis, Nginx, certbot deps,
adds swap, clones the repo, installs all dependencies, then **stops** and creates
empty `.env` files for you to fill in.

## 6. 👤 Fill in the secrets, then re-run
```bash
cd ~/apps/Prompto
nano server/.env
nano python-service/.env
bash deploy/setup.sh        # re-run: this time it starts everything
```
**`server/.env` must include (in addition to your API keys):**
```
PORT=3001
REDIS_URL=redis://127.0.0.1:6379
PYTHON_AI_URL=http://127.0.0.1:8000
CLIENT_URL=https://prompto.keshavkashyap.me
INTERNAL_API_KEY=<same-long-random-string-as-python>
```
**`python-service/.env` must include:**
```
MONGODB_DB_NAME=quickgpt
INTERNAL_API_KEY=<same-long-random-string-as-server>
```
🤖 Re-running starts both services under PM2, enables reboot-persistence, and
installs the Nginx site.

## 7. 👤 + 🤖 Get HTTPS
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d prompto-api.keshavkashyap.me
```
Certbot obtains the cert and rewrites the Nginx config to serve 443 + redirect 80.
**Cloudflare users:** now flip the DNS record back to **Proxied (orange cloud)**
and set SSL mode to **Full (strict)**.

## 8. 👤 Repoint the frontend (only if the API domain changed)
- Vercel → project → env `VITE_SERVER_URL` = `https://prompto-api.keshavkashyap.me`, redeploy.
- Stripe webhook endpoint → `https://prompto-api.<domain>/api/webhook/stripe`
  (unchanged if you reused the same subdomain).

---

## Verify
```bash
pm2 status                       # both prompto-backend + prompto-python = online
curl -s http://127.0.0.1:8000/   # Python service reachable locally only
curl -s https://prompto-api.<domain>/   # backend via nginx+SSL
```

## Day-2 operations
| Task | Command (on the VM, in `~/apps/Prompto`) |
|---|---|
| Deploy new code | `git pull && cd server && pnpm install --prod && cd .. && pm2 reload deploy/ecosystem.config.cjs` |
| Update Python deps | `python-service/venv/bin/pip install -r python-service/requirements.txt && pm2 reload prompto-python` |
| Logs | `pm2 logs prompto-backend` / `pm2 logs prompto-python` |
| Restart one service | `pm2 restart prompto-backend` |
| Save credits (pause) | Azure portal → VM → **Stop (deallocate)**; compute billing stops, only the tiny disk cost remains |

## Notes
- **Python stays private:** it binds to `127.0.0.1:8000` and port 8000 is never
  opened in the NSG, so it's only reachable from the backend on the same box —
  this satisfies the "firewall port 8000" item in `PENDING_PYTHON_SERVICE.md`.
- **Redis is local & free** here; `REDIS_URL` makes rate limiting shared/persistent.
- Never hand-edit tracked files on the VM — edit locally, push, `git pull` on the VM.
