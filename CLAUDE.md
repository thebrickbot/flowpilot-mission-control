# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Mission Control is a centralized operations and governance platform for running OpenClaw across teams and organizations. It provides work orchestration, agent management, approval-driven governance, gateway management, and activity visibility through both a web UI and an API.

## Architecture

**Monorepo with two main services:**

- **Backend** (`backend/`): Python 3.12+ FastAPI app using SQLAlchemy/SQLModel with async PostgreSQL (psycopg), Alembic migrations, and Redis/RQ for background jobs. All API routes are under `/api/v1`. The app entrypoint is `backend/app/main.py`.
- **Frontend** (`frontend/`): Next.js 16 app (React 19) using TypeScript, Tailwind CSS, Radix UI, TanStack Query/Table, and Recharts. Uses Orval to generate a typed API client from the backend's OpenAPI spec into `frontend/src/api/generated/` — never edit generated files by hand.
- **MCP Server** (`mcp-server/`): Node.js 20+ TypeScript MCP server that exposes the FPMC REST API as MCP tools, resources, and prompts. Uses `@modelcontextprotocol/sdk` with `McpServer` and Zod schemas. Runs over stdio transport. Build with `tsup`, test with `vitest`. See `mcp-server/.env.example` for required config.

**Ignore `adoring-nobel/`:** This top-level directory is an abandoned development attempt — superseded by `mcp-server/`. Do not reference, modify, or import from it. Exclude it from searches.

**Infrastructure:** Docker Compose orchestrates PostgreSQL 16, Redis 7, the backend, frontend, and a webhook-worker (RQ consumer). See `compose.yml`.

**Auth modes:** `local` (shared bearer token) or `clerk` (Clerk JWT). Configured via `AUTH_MODE` env var.

**Key backend layers:**
- `app/api/` — FastAPI route handlers (one file per domain)
- `app/models/` — SQLModel ORM models
- `app/schemas/` — Pydantic request/response schemas
- `app/services/` — Business logic (activity logging, approvals, board lifecycle, webhooks, etc.)
- `app/core/` — Config, auth, error handling, logging
- `app/db/` — Session management, CRUD helpers, pagination

**Key frontend layers:**
- `src/app/` — Next.js App Router pages
- `src/components/` — UI components organized by domain (agents, boards, gateways, etc.) plus `ui/` for primitives
- `src/lib/` — Utilities, hooks, and shared helpers
- `src/api/generated/` — Auto-generated API client (regenerate with `make api-gen`)
- The `@/` import alias maps to `src/` (configured in `tsconfig.json` and `vitest.config.ts`)

**Key MCP server layers:**
- `src/index.ts` — Entry point: McpServer init, transport, tool/resource/prompt registration
- `src/lib/` — HTTP client (`client.ts`), config validation (`config.ts`), error mapping (`errors.ts`), result helpers (`result.ts`)
- `src/tools/` — One file per domain: boards, tasks, agents, approvals, webhooks, memory, groups, infra, onboarding
- `src/resources/` — 9 MCP resources (static + ResourceTemplate for parameterized URIs)
- `src/prompts/` — 4 workflow prompts: fpmc_onboard, fpmc_standup, fpmc_audit, fpmc_triage

## Common Commands

```bash
# Install all dependencies
make setup

# Run full CI-parity checks (lint + typecheck + tests + coverage + build)
make check

# Full stack via Docker
docker compose -f compose.yml --env-file .env up -d --build

# Fast local dev loop (start DB in Docker, run services natively)
docker compose -f compose.yml --env-file .env up -d db
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev

# Backend
make backend-lint          # flake8
make backend-format        # isort + black
make backend-typecheck     # mypy --strict
make backend-test          # pytest (all tests, no DB required — uses SQLite in-memory)
cd backend && uv run pytest tests/test_mentions.py              # single test file
cd backend && uv run pytest tests/test_mentions.py::test_name   # single test
make backend-coverage      # pytest with 100% coverage gate on scoped modules
make backend-migrate       # alembic upgrade head

# Frontend
make frontend-lint         # eslint
make frontend-format       # prettier
make frontend-typecheck    # tsc --noEmit
make frontend-test         # vitest run with coverage
cd frontend && npm run test:watch   # vitest in watch mode
make frontend-build        # next build

# API client regeneration (backend must be running on 127.0.0.1:8000)
make api-gen

# MCP Server
cd mcp-server && npm install   # install deps
cd mcp-server && npm run dev   # dev mode with hot reload
cd mcp-server && npm run build # production build → dist/
cd mcp-server && npm run typecheck  # type checking only
cd mcp-server && npm run test  # run tests
```

## Code Style

- **Python:** Black + isort + flake8 + strict mypy. Line length 100. `snake_case` everywhere. Target Python 3.12.
- **TypeScript/React:** ESLint + Prettier. Components `PascalCase`, variables/functions `camelCase`. Prefix intentionally unused destructured variables with `_`.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `docs:`, `test(core):`, etc.

## Policies

- **One migration per PR:** PRs must add at most one file under `backend/migrations/versions/`. CI enforces this. If you have multiple Alembic heads, create one merge migration.
- **Migration integrity:** CI validates migrations can apply cleanly (`upgrade head`), downgrade to base, and re-upgrade. Test locally with `make backend-migration-check`.
- **Backend coverage:** 100% statement+branch coverage is enforced on scoped modules (`app.core.error_handling`, `app.services.mentions`). Overall coverage is tracked but not gated yet.
- **Frontend coverage:** 100% coverage (lines/statements/functions/branches) is enforced on scoped modules (`src/lib/backoff.ts`, `src/components/activity/ActivityFeed.tsx`). The scope will expand as tests are added.
- **Generated code:** `frontend/src/api/generated/` is auto-generated by Orval. Regenerate with `make api-gen` instead of editing by hand.
