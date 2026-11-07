# Archived Azure deployment notes (not an executable runbook)

The former `deploy/setup.sh` has been removed because it executed downloaded
and generated shell commands. Do not fetch or run it from old commits or raw
GitHub URLs. These notes describe the previous architecture; use a separately
reviewed procedure and rotated credentials for any new deployment.

A lift-and-shift of the DigitalOcean setup onto one Azure Linux VM:
**Nginx (SSL) → Node backend `:3001`**, with the **Python AI service private on
`127.0.0.1:8000`** and **Redis local on `:6379`**. MongoDB Atlas and Gemini stay
external. Frontend stays on Vercel.

The steps below are historical context and must not be followed as an automated setup.

---

## 0. Before you start
- Keep credits alive: **B1s** VM (1 vCPU / 1 GB) with a separately provisioned
  2 GB swap file was the previous sizing plan. Bump to
  **B1ms** (2 GB) later if you see the Python service getting OOM-restarted.
- Have ready: MongoDB Atlas URI, Gemini API key, ImageKit keys, Stripe keys,
  a **Resend API key**, and a strong `INTERNAL_API_KEY` (same string in both services).
- Email goes over Resend's HTTPS API, not SMTP. Cloud providers block outbound
  25/465/587 by default — Azure included — so an SMTP transport cannot connect
  from the VM at all. Don't swap it back to Gmail; it will fail the same way.

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

> This rule is load-bearing, not just tidiness. The AI service having no public
> attack surface rests on two things: uvicorn binding `127.0.0.1` (set in
> `deploy/ecosystem.config.cjs`) and 8000 never being opened here. Exposing it —
> or adding an Nginx vhost for it — would make that claim untrue. Verify after
> cutover: from your laptop, `curl http://<VM_IP>:8000/` must fail to connect,
> and the same for 3001 and 6379.

## 3. 👤 Whitelist the VM in MongoDB Atlas
Atlas → *Network Access* → *Add IP Address* → paste the VM's **public IP**.
(Without this the backend and Python service can't reach the database.)

## 4. 👤 Point DNS at the VM
Add/repoint an **A record** for your API subdomain (e.g.
`prompto-api.keshavkashyap.me`) → the VM's public IP.
**Cloudflare users:** set it to **DNS only (grey cloud)** for now — you'll flip it
back to proxied after the SSL cert is issued (step 7).

## 5. Provision a clean host using a reviewed procedure
Install Node, pnpm, Python, Redis, and Nginx from trusted sources. Check out only
a verified current commit with Git hooks disabled. Inspect dependency install
hooks before installing packages; do not pipe downloaded scripts or generated
commands into a shell. This archived document does not automate provisioning.

## 6. Configure rotated secrets and start the reviewed services
Create `server/.env` and `python-service/.env` on the clean host using a secure
channel after rotating any credentials that were available to the compromised
laptop. Verify the PM2 configuration and network policy before starting either
service.
**`server/.env` must include (in addition to your API keys):**
```
PORT=3001
NODE_ENV=production
REDIS_URL=redis://127.0.0.1:6379
PYTHON_AI_URL=http://127.0.0.1:8000
CLIENT_URL=https://prompto.keshavkashyap.me
INTERNAL_API_KEY=<same-long-random-string-as-python>

# Email over HTTPS. EMAIL_FROM must be on a domain verified in Resend, or
# delivery is limited to the account owner's own address.
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=Prompto <noreply@keshavkashyap.me>
```
`NODE_ENV=production` is what sets the `Secure` flag on the auth cookie, so it
is not optional — PM2 sets it too, but the file should agree.
**`python-service/.env` must include:**
```
MONGODB_DB_NAME=quickgpt
INTERNAL_API_KEY=<same-long-random-string-as-server>
```
Start services and configure boot persistence only after reviewing the exact
commands and validating that the Python service stays bound to loopback.

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
| Deploy new code | Review and pin the new commit, inspect install hooks, then deploy through the approved release procedure. |
| Update Python deps | Review the pinned requirements and install on a clean host before reloading the service. |
| Logs | `pm2 logs prompto-backend` / `pm2 logs prompto-python` |
| Restart one service | `pm2 restart prompto-backend` |
| Save credits (pause) | Azure portal → VM → **Stop (deallocate)**; compute billing stops, only the tiny disk cost remains |

## Notes
- **Python stays private:** it binds to `127.0.0.1:8000` and port 8000 is never
  opened in the NSG, so it's only reachable from the backend on the same box —
  this satisfies the "firewall port 8000" item in `PENDING_PYTHON_SERVICE.md`.
- **Redis is local & free** here; `REDIS_URL` makes rate limiting shared/persistent.
- Never hand-edit tracked files on the VM; deploy a reviewed commit rather than pulling blindly.
