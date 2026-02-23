# FlowPilot Mission Control — Gateway Setup

This guide explains how to connect **FlowPilot Mission Control** to an
**OpenClaw gateway** running on Atlas (or any remote host).

---

## Table of Contents

1. [Overview](#overview)
2. [Backend `.env` Configuration](#backend-env-configuration)
3. [Frontend `.env` Configuration](#frontend-env-configuration)
4. [Local Auth Token Setup](#local-auth-token-setup)
5. [Connecting to the OpenClaw Gateway on Atlas](#connecting-to-the-openclaw-gateway-on-atlas)
6. [Verifying Connectivity](#verifying-connectivity)
7. [Troubleshooting](#troubleshooting)

---

## Overview

FlowPilot Mission Control has two network seams:

| Seam | Direction | Purpose |
|------|-----------|---------|
| **Browser → Backend API** | `NEXT_PUBLIC_API_URL` | Task data, boards, metrics |
| **Backend → OpenClaw Gateway** | `GATEWAY_URL` (per gateway record) | Agent heartbeats, commands, WebSocket relay |

Gateways are registered in the Mission Control UI under **Administration → Gateways** and store their URL in the database. The values below control the *default* and *infrastructure* settings.

---

## Backend `.env` Configuration

Located at `backend/.env` (copy from `backend/.env.example`).

```dotenv
# ── Core ─────────────────────────────────────────────────────────────────────
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://flowpilot:changeme@localhost:5432/flowpilot_mc
BASE_URL=http://localhost:8000

# ── CORS ─────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed frontend origins
CORS_ORIGINS=http://localhost:3000

# ── Auth ─────────────────────────────────────────────────────────────────────
AUTH_MODE=local
# Token must be at least 50 characters. Generate with:
#   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
LOCAL_AUTH_TOKEN=<your-secure-token-here>

# ── Gateway ──────────────────────────────────────────────────────────────────
# Minimum acceptable OpenClaw gateway version (semver)
GATEWAY_MIN_VERSION=2026.02.9

# ── Queue / Worker ────────────────────────────────────────────────────────────
RQ_REDIS_URL=redis://localhost:6379/0
RQ_QUEUE_NAME=default
RQ_DISPATCH_THROTTLE_SECONDS=15.0
RQ_DISPATCH_MAX_RETRIES=3
```

> **Note:** There is no single `GATEWAY_URL` env var — gateway URLs are stored
> per-gateway in the database and managed in the UI. The `GATEWAY_MIN_VERSION`
> controls the minimum version Mission Control will accept connections from.

---

## Frontend `.env` Configuration

Located at `frontend/.env.local` (copy from `frontend/.env.example`).

```dotenv
# URL the browser uses to reach the backend API.
# Must be reachable from the end-user's machine (not Docker-internal).
NEXT_PUBLIC_API_URL=http://localhost:8000

# Auth mode: local (shared token) or clerk (Clerk.dev SSO)
NEXT_PUBLIC_AUTH_MODE=local

# Clerk (only needed when AUTH_MODE=clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/boards
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/

# FlowPilot branding
NEXT_PUBLIC_APP_NAME=FlowPilot Mission Control
```

---

## Local Auth Token Setup

When `AUTH_MODE=local`, all API requests are authenticated with a shared
bearer token. This is the recommended mode for single-tenant/Atlas deployments.

### 1 — Generate a token

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Example output:

```
kQ8Jp2m-vFxA3nZRdT0LcYbEWouGsIhMKPpNqDVl7ejC6ySXi
```

### 2 — Add it to the backend `.env`

```dotenv
AUTH_MODE=local
LOCAL_AUTH_TOKEN=kQ8Jp2m-vFxA3nZRdT0LcYbEWouGsIhMKPpNqDVl7ejC6ySXi
```

### 3 — Configure it in the Mission Control UI

On first launch, go to **http://localhost:3000** → enter your token in the
local-auth login screen. The token is stored in your browser's local storage.

### 4 — Use it programmatically (agents / gateways)

Any service that calls the API must pass:

```http
Authorization: Bearer kQ8Jp2m-vFxA3nZRdT0LcYbEWouGsIhMKPpNqDVl7ejC6ySXi
```

---

## Connecting to the OpenClaw Gateway on Atlas

### Architecture

```
Atlas (macOS)
├── OpenClaw Gateway  → ws://localhost:9000  (or OpenClaw daemon port)
└── FlowPilot Backend → :8000
        ↑ registers gateway URL in DB
        ↑ opens WebSocket relay to gateway

Browser
└── FlowPilot Frontend → :3000
        ↑ reads data via backend REST API
```

### Step 1 — Start the OpenClaw gateway

```bash
openclaw gateway start
openclaw gateway status
# → Gateway running on ws://localhost:9000 (or whatever port is configured)
```

### Step 2 — Register the gateway in Mission Control

1. Open **http://localhost:3000** → sign in
2. Go to **Administration → Gateways → New gateway**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | **Name** | Atlas Local |
   | **URL** | `ws://localhost:9000` (or your gateway's WS URL) |
   | **Description** | OpenClaw gateway on Atlas Mac |

4. Click **Save**

### Step 3 — Verify the connection

In **Administration → Gateways**, the new gateway should show:

- Status: **Connected** (green dot)
- Version: matching or above `GATEWAY_MIN_VERSION`

> If the gateway shows **Degraded**, check [Troubleshooting](#troubleshooting).

### Step 4 — Assign agents to the gateway

In **Administration → Agents**, set each agent's **Gateway** to the newly
registered gateway. Agents will start sending heartbeats through it.

---

## Remote Atlas access (over LAN/Tailscale)

If the browser runs on a different machine from Atlas:

1. Replace `localhost` with Atlas's LAN IP or Tailscale IP:

   ```dotenv
   # frontend/.env.local
   NEXT_PUBLIC_API_URL=http://192.168.1.50:8000
   ```

2. Update backend CORS:

   ```dotenv
   # backend/.env
   CORS_ORIGINS=http://192.168.1.50:3000,http://your-dev-machine:3000
   ```

3. For the gateway URL, use the same IP:

   ```
   ws://192.168.1.50:9000
   ```

---

## Verifying Connectivity

```bash
# Health check (backend)
curl http://localhost:8000/healthz

# Expected response:
# {"ok": true}

# Metrics ping (requires auth token)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/metrics/dashboard

# Gateway WebSocket test (requires wscat: npm install -g wscat)
wscat -c ws://localhost:9000
```

---

## Troubleshooting

### Gateway shows "Degraded"

1. Check the gateway is actually running:
   ```bash
   openclaw gateway status
   ```
2. Confirm the URL in Mission Control matches exactly (ws:// vs wss://, port).
3. Check backend logs:
   ```bash
   tail -f logs/backend.error.log
   ```

### `CORS` errors in browser console

Add the frontend origin to `CORS_ORIGINS` in `backend/.env` and restart the backend.

### `LOCAL_AUTH_TOKEN` rejected

- Ensure the token is **≥ 50 characters** (shorter tokens are rejected at startup).
- Confirm the token in the UI matches `LOCAL_AUTH_TOKEN` in `backend/.env` exactly (no trailing spaces).

### Gateway version mismatch

Update OpenClaw to at least `GATEWAY_MIN_VERSION`:
```bash
openclaw update   # or however OpenClaw is distributed on Atlas
```
Or lower the minimum version in `backend/.env` temporarily:
```dotenv
GATEWAY_MIN_VERSION=2025.01.0
```

### Port conflicts

| Service | Default port | Change via |
|---------|-------------|-----------|
| Frontend | 3000 | `npm start -- --port 3001` |
| Backend | 8000 | uvicorn `--port` arg |
| Gateway | 9000 | `openclaw gateway --port 9001` |
| Redis | 6379 | `RQ_REDIS_URL` in `.env` |
| Postgres | 5432 | `DATABASE_URL` in `.env` |
