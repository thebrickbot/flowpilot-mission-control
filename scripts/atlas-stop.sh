#!/usr/bin/env bash
# =============================================================================
# FlowPilot Mission Control — Atlas Stop
# =============================================================================
# Gracefully stops all FlowPilot services.
# Supports both launchd-managed and manually started processes.
#
# Usage:
#   ./scripts/atlas-stop.sh [--keep-db] [--force]
#
# Flags:
#   --keep-db   Leave PostgreSQL and Redis running (useful during dev)
#   --force     SIGKILL instead of SIGTERM for stubborn processes
# =============================================================================
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
info() { echo -e "${CYAN}[stop]${RESET} $*"; }
ok()   { echo -e "${GREEN}[✓]${RESET} $*"; }
warn() { echo -e "${YELLOW}[!]${RESET} $*"; }

KEEP_DB=false
FORCE=false
for arg in "$@"; do
  case "$arg" in
    --keep-db) KEEP_DB=true ;;
    --force)   FORCE=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"
SERVICE_PREFIX="com.flowpilot.missioncontrol"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
SIGNAL="${FORCE:+KILL}"
SIGNAL="${SIGNAL:-TERM}"

# ── Helper: stop a PID file process ──────────────────────────────────────────
stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "-$SIGNAL" "$pid"
      ok "Stopped $name (PID $pid)"
    else
      warn "$name PID $pid not running (stale pid file)"
    fi
    rm -f "$pid_file"
  fi
}

# ── launchd services ──────────────────────────────────────────────────────────
info "Stopping launchd services…"
for svc in frontend worker backend; do
  plist_path="$LAUNCHD_DIR/${SERVICE_PREFIX}.${svc}.plist"
  if [[ -f "$plist_path" ]]; then
    launchctl unload "$plist_path" 2>/dev/null && ok "Unloaded: ${SERVICE_PREFIX}.${svc}" || true
  fi
done

# ── Manually started processes (PID files) ────────────────────────────────────
info "Stopping manually started processes…"
stop_pid frontend
stop_pid worker
stop_pid backend

# ── Port-based fallback ───────────────────────────────────────────────────────
# In case PID files are gone but processes still run on the expected ports
for port in 3000 8000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    info "Killing residual process on :${port}…"
    # shellcheck disable=SC2086
    kill "-$SIGNAL" $pids 2>/dev/null && ok "Killed :${port} (PIDs: $pids)" || true
  fi
done

# ── Database / cache services ─────────────────────────────────────────────────
if ! $KEEP_DB; then
  info "Stopping Redis…"
  brew services stop redis 2>/dev/null && ok "Redis stopped" || warn "Redis stop: nothing to do"

  info "Stopping PostgreSQL…"
  brew services stop postgresql@16 2>/dev/null && ok "PostgreSQL stopped" || warn "PostgreSQL stop: nothing to do"
else
  warn "Leaving PostgreSQL and Redis running (--keep-db)"
fi

echo
echo -e "${BOLD}${GREEN}FlowPilot Mission Control — all services stopped${RESET}"
echo
