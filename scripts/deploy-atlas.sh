#!/usr/bin/env bash
# =============================================================================
# FlowPilot Mission Control — Atlas Native macOS Deployment
# =============================================================================
# Installs and configures the full stack for native operation on macOS (Atlas).
#
# What this script does:
#   1. Checks prerequisites and installs dependencies via Homebrew
#   2. Sets up Python 3.12 virtual environment with uv
#   3. Creates .env files from templates
#   4. Initialises/migrates the database
#   5. Builds the Next.js frontend
#   6. Registers launchd plists for backend, worker, and frontend services
#
# Usage:
#   chmod +x scripts/deploy-atlas.sh
#   ./scripts/deploy-atlas.sh [--no-build] [--no-launchd]
#
# Flags:
#   --no-build     Skip frontend npm build (use when iterating on backend only)
#   --no-launchd   Skip launchd plist creation (manual start only)
# =============================================================================
set -euo pipefail

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()  { echo -e "${CYAN}[atlas]${RESET} $*"; }
ok()    { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[!]${RESET} $*"; }
fail()  { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }

# ── Argument parsing ────────────────────────────────────────────────────────
BUILD_FRONTEND=true
INSTALL_LAUNCHD=true
for arg in "$@"; do
  case "$arg" in
    --no-build)   BUILD_FRONTEND=false ;;
    --no-launchd) INSTALL_LAUNCHD=false ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ── Paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
SERVICE_PREFIX="com.flowpilot.missioncontrol"

info "FlowPilot Mission Control — Atlas Deployment"
info "Project root: $PROJECT_ROOT"
echo

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
info "Step 1/6 — Checking prerequisites"

if ! command -v brew &>/dev/null; then
  fail "Homebrew not found. Install it first: https://brew.sh"
fi
ok "Homebrew found: $(brew --version | head -1)"

# Install Homebrew packages
BREW_PACKAGES=(postgresql@16 redis python@3.12)
for pkg in "${BREW_PACKAGES[@]}"; do
  if brew list "$pkg" &>/dev/null; then
    ok "$pkg already installed"
  else
    info "Installing $pkg via Homebrew…"
    brew install "$pkg"
    ok "$pkg installed"
  fi
done

# Install uv (fast Python package manager)
if ! command -v uv &>/dev/null; then
  info "Installing uv…"
  brew install uv || pip3 install uv
fi
ok "uv: $(uv --version)"

# Install Node.js / npm for frontend
if ! command -v node &>/dev/null; then
  info "Installing Node.js via Homebrew…"
  brew install node
fi
ok "Node: $(node --version) | npm: $(npm --version)"

echo

# ── 2. Python virtual environment ────────────────────────────────────────────
info "Step 2/6 — Setting up Python 3.12 virtual environment"

cd "$BACKEND_DIR"
if [[ ! -d "$VENV_DIR" ]]; then
  uv venv --python python3.12 "$VENV_DIR"
  ok "Virtual environment created: $VENV_DIR"
else
  ok "Virtual environment exists: $VENV_DIR"
fi

info "Installing Python dependencies (uv sync)…"
uv sync --frozen
ok "Python dependencies installed"
echo

# ── 3. Environment files ──────────────────────────────────────────────────────
info "Step 3/6 — Creating .env files from templates"

# Backend .env
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  # Inject a secure LOCAL_AUTH_TOKEN
  local_token=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
  # macOS sed requires an empty-string backup suffix
  sed -i '' "s/^LOCAL_AUTH_TOKEN=.*/LOCAL_AUTH_TOKEN=${local_token}/" "$BACKEND_DIR/.env"
  ok "Backend .env created (LOCAL_AUTH_TOKEN auto-generated)"
  warn "Edit $BACKEND_DIR/.env to set DATABASE_URL, CORS_ORIGINS, etc."
else
  ok "Backend .env already exists (not overwritten)"
fi

# Frontend .env
if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
  ok "Frontend .env.local created from template"
  warn "Edit $FRONTEND_DIR/.env.local to configure NEXT_PUBLIC_API_URL"
else
  ok "Frontend .env.local already exists (not overwritten)"
fi
echo

# ── 4. Database initialisation ────────────────────────────────────────────────
info "Step 4/6 — Database setup"

# Start postgres if not running
if ! pg_isready -q 2>/dev/null; then
  info "Starting PostgreSQL…"
  brew services start postgresql@16
  sleep 2
fi
ok "PostgreSQL is running"

# Load DB URL from backend .env
DB_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | cut -d= -f2- | tr -d '"')
DB_NAME=$(echo "$DB_URL" | sed 's|.*://[^/]*/||' | cut -d'?' -f1)

info "Creating database '$DB_NAME' if it doesn't exist…"
createdb "$DB_NAME" 2>/dev/null && ok "Database '$DB_NAME' created" || ok "Database '$DB_NAME' already exists"

info "Running Alembic migrations…"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/alembic" upgrade head
ok "Database migrations applied"
echo

# ── 5. Frontend build ─────────────────────────────────────────────────────────
info "Step 5/6 — Frontend build"

if $BUILD_FRONTEND; then
  cd "$FRONTEND_DIR"
  info "Installing npm dependencies…"
  npm ci --prefer-offline
  info "Building Next.js production bundle…"
  npm run build
  ok "Frontend build complete → $FRONTEND_DIR/.next"
else
  warn "Skipping frontend build (--no-build flag)"
fi
echo

# ── 6. launchd plists ─────────────────────────────────────────────────────────
info "Step 6/6 — Installing launchd service plists"

if $INSTALL_LAUNCHD; then
  mkdir -p "$LAUNCHD_DIR"

  # ── Backend (uvicorn) ──
  cat > "$LAUNCHD_DIR/${SERVICE_PREFIX}.backend.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_PREFIX}.backend</string>
  <key>ProgramArguments</key>
  <array>
    <string>${VENV_DIR}/bin/uvicorn</string>
    <string>app.main:app</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>8000</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${BACKEND_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONPATH</key>
    <string>${BACKEND_DIR}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${PROJECT_ROOT}/logs/backend.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_ROOT}/logs/backend.error.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST

  # ── RQ Worker ──
  cat > "$LAUNCHD_DIR/${SERVICE_PREFIX}.worker.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_PREFIX}.worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>${VENV_DIR}/bin/rq</string>
    <string>worker</string>
    <string>--with-scheduler</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${BACKEND_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONPATH</key>
    <string>${BACKEND_DIR}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${PROJECT_ROOT}/logs/worker.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_ROOT}/logs/worker.error.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST

  # ── Frontend (Next.js) ──
  cat > "$LAUNCHD_DIR/${SERVICE_PREFIX}.frontend.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_PREFIX}.frontend</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${FRONTEND_DIR}/node_modules/.bin/next</string>
    <string>start</string>
    <string>--port</string>
    <string>3000</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${FRONTEND_DIR}</string>
  <key>StandardOutPath</key>
  <string>${PROJECT_ROOT}/logs/frontend.log</string>
  <key>StandardErrorPath</key>
  <string>${PROJECT_ROOT}/logs/frontend.error.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLIST

  # Create log directory
  mkdir -p "$PROJECT_ROOT/logs"

  # Load the plists
  for svc in backend worker frontend; do
    plist_path="$LAUNCHD_DIR/${SERVICE_PREFIX}.${svc}.plist"
    launchctl unload "$plist_path" 2>/dev/null || true
    launchctl load "$plist_path"
    ok "launchd: ${SERVICE_PREFIX}.${svc} loaded"
  done
else
  warn "Skipping launchd installation (--no-launchd flag)"
  info "To start manually, use: ./scripts/atlas-start.sh"
fi

echo
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  FlowPilot Mission Control — Atlas deployment complete${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo
echo -e "  Frontend  → ${CYAN}http://localhost:3000${RESET}"
echo -e "  Backend   → ${CYAN}http://localhost:8000${RESET}"
echo -e "  API docs  → ${CYAN}http://localhost:8000/docs${RESET}"
echo
echo -e "  Manage:   ${YELLOW}./scripts/atlas-start.sh${RESET}  |  ${YELLOW}./scripts/atlas-stop.sh${RESET}"
echo
