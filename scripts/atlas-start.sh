#!/usr/bin/env bash
# =============================================================================
# FlowPilot Mission Control — Atlas Start
# =============================================================================
# Starts all services in the correct order:
#   PostgreSQL → Redis → Backend API → RQ Worker → Frontend
#
# Usage:
#   ./scripts/atlas-start.sh [--dev] [--no-frontend]
#
# Flags:
#   --dev          Start frontend in dev mode (next dev) instead of next start
#   --no-frontend  Skip frontend service (API + worker only)
# =============================================================================
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
info() { echo -e "${CYAN}[start]${RESET} $*"; }
ok()   { echo -e "${GREEN}[✓]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }
fail() { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }

DEV_MODE=false
NO_FRONTEND=false
for arg in "$@"; do
  case "$arg" in
    --dev)          DEV_MODE=true ;;
    --no-frontend)  NO_FRONTEND=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.pids"
SERVICE_PREFIX="com.flowpilot.missioncontrol"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"

mkdir -p "$LOG_DIR" "$PID_DIR"

# ── Check launchd mode vs manual mode ────────────────────────────────────────
USE_LAUNCHD=false
if [[ -f "$LAUNCHD_DIR/${SERVICE_PREFIX}.backend.plist" ]]; then
  USE_LAUNCHD=true
fi

if $USE_LAUNCHD && ! $DEV_MODE; then
  info "Using launchd service management"

  # 1. System services
  info "Starting PostgreSQL…"
  brew services start postgresql@16 2>/dev/null || true
  sleep 1

  info "Starting Redis…"
  brew services start redis 2>/dev/null || true
  sleep 1

  # 2. App services
  for svc in backend worker; do
    launchctl load -w "$LAUNCHD_DIR/${SERVICE_PREFIX}.${svc}.plist" 2>/dev/null || \
      launchctl start "${SERVICE_PREFIX}.${svc}" 2>/dev/null || true
    ok "Started: ${SERVICE_PREFIX}.${svc}"
  done

  if ! $NO_FRONTEND; then
    launchctl load -w "$LAUNCHD_DIR/${SERVICE_PREFIX}.frontend.plist" 2>/dev/null || \
      launchctl start "${SERVICE_PREFIX}.frontend" 2>/dev/null || true
    ok "Started: ${SERVICE_PREFIX}.frontend"
  fi
else
  # ── Manual / dev mode ──────────────────────────────────────────────────────
  info "Starting services in manual mode${DEV_MODE:+ (dev)}…"

  # Validate environment
  [[ -f "$BACKEND_DIR/.env" ]]         || fail ".env missing — run deploy-atlas.sh first"
  [[ -d "$VENV_DIR" ]]                 || fail "Python venv missing — run deploy-atlas.sh first"
  [[ -f "$FRONTEND_DIR/package.json" ]] || fail "frontend/package.json missing"

  # 1. PostgreSQL
  info "Starting PostgreSQL…"
  brew services start postgresql@16 2>/dev/null || pg_isready -q && ok "PostgreSQL running"
  sleep 1

  # 2. Redis
  info "Starting Redis…"
  brew services start redis 2>/dev/null || redis-cli ping &>/dev/null && ok "Redis running"
  sleep 1

  # 3. Backend API (uvicorn)
  info "Starting backend API on :8000…"
  cd "$BACKEND_DIR"
  nohup "$VENV_DIR/bin/uvicorn" app.main:app \
    --host 0.0.0.0 --port 8000 \
    --reload \
    > "$LOG_DIR/backend.log" 2> "$LOG_DIR/backend.error.log" &
  echo $! > "$PID_DIR/backend.pid"
  ok "Backend started (PID: $(cat "$PID_DIR/backend.pid"))"

  # 4. RQ Worker
  info "Starting RQ worker…"
  nohup "$VENV_DIR/bin/rq" worker --with-scheduler \
    > "$LOG_DIR/worker.log" 2> "$LOG_DIR/worker.error.log" &
  echo $! > "$PID_DIR/worker.pid"
  ok "Worker started (PID: $(cat "$PID_DIR/worker.pid"))"

  # 5. Frontend
  if ! $NO_FRONTEND; then
    cd "$FRONTEND_DIR"
    if $DEV_MODE; then
      info "Starting Next.js dev server on :3000…"
      nohup npm run dev > "$LOG_DIR/frontend.log" 2> "$LOG_DIR/frontend.error.log" &
    else
      info "Starting Next.js production server on :3000…"
      nohup npm start > "$LOG_DIR/frontend.log" 2> "$LOG_DIR/frontend.error.log" &
    fi
    echo $! > "$PID_DIR/frontend.pid"
    ok "Frontend started (PID: $(cat "$PID_DIR/frontend.pid"))"
  fi
fi

echo
echo -e "${BOLD}${GREEN}FlowPilot Mission Control — running${RESET}"
echo -e "  Frontend  → ${CYAN}http://localhost:3000${RESET}"
echo -e "  Backend   → ${CYAN}http://localhost:8000${RESET}"
echo -e "  API docs  → ${CYAN}http://localhost:8000/docs${RESET}"
echo -e "  Logs      → ${YELLOW}$LOG_DIR/${RESET}"
echo
