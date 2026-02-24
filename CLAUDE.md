# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RiffMaster is a full-stack TypeScript monorepo for an AI-assisted guitar tab generator. Users input a song title, artist, and tempo; the app runs a 3-step pipeline (analysis → composition → guitarisation) and returns an ASCII guitar tab.

## Monorepo Structure

```
riffmaster/
├── shared/       # @riffmaster/shared — Zod schemas and TypeScript types
├── backend/      # @riffmaster/backend — Express API + pipeline
├── frontend/     # @riffmaster/frontend — React + Vite + Tailwind
└── deploy/       # Nginx config for Docker deployment
```

Package manager: **pnpm** (>=9.0.0). Node >=20 required.

## Commands

All commands run from the repo root unless noted.

```bash
# Install
pnpm install

# Development (builds shared first, then runs backend + frontend in parallel)
pnpm dev

# Production build
pnpm build

# Lint (ESLint across all packages)
pnpm lint

# Prettier check / auto-fix
pnpm format
pnpm format:write

# Docker
pnpm docker:build
pnpm docker:up       # Serves full stack on localhost:8080
```

Per-package dev (run inside the package directory):
```bash
# backend: tsx hot-reload
pnpm dev   # tsx src/index.ts — serves on :4000

# frontend: Vite dev server
pnpm dev   # serves on :5173, proxies /api → localhost:4000

# shared: compile only
pnpm build
```

## Architecture

### Shared Package (`shared/src/`)
Single source of truth for request/response contracts. All Zod schemas live in `schemas.ts`; TypeScript types are inferred from them in `types.ts`. Both backend and frontend import from `@riffmaster/shared`.

Key types: `GenerateTabRequest`, `GenerateTabResponse`, `TabModel`, `AnalysisResult`, `CompositionResult`, `GuitarisationResult`.

### Backend Pipeline (`backend/src/pipeline/`)
`POST /api/generate-tab` → `runGenerateTabPipeline()` → three sequential steps:

1. **analysis.ts** — deterministically selects a chord progression from hardcoded templates using a hash of the request inputs
2. **composition.ts** — generates notes using a basic arpeggio pattern over the chord progression
3. **guitarisation.ts** — wraps notes with standard tuning (E-A-D-G-B-E) and tempo

Each step's result is independently cached (1-hour TTL) by `services/cache.ts`, which transparently uses Redis (`REDIS_URL` env) or falls back to an in-memory Map.

ASCII rendering is a separate utility: `tab/renderAsciiTab.ts`.

### Backend Entry (`backend/src/`)
- `index.ts` — loads `.env`, starts server
- `app.ts` — Express app factory, attaches CORS and routes
- `routes/generateTab.ts` — validates request with Zod, calls pipeline, returns response

### Frontend Data Flow
`ChordForm` → `client.ts` `generateTab()` → `POST /api/generate-tab` → `TabDisplay`

`frontend/src/api/client.ts` validates both the outgoing request and incoming response with Zod schemas from `@riffmaster/shared`. The Vite dev server proxies `/api/*` to `http://localhost:4000`.

## Environment Variables

**Backend** (copy `backend/.env.example` → `backend/.env`):
- `PORT` — default `4000`
- `REDIS_URL` — if absent, in-memory cache is used
- `ALLOWED_ORIGIN` — CORS origin, default `*`
- `ANTHROPIC_API_KEY` — loaded but not yet used (pipeline is currently mocked)

**Frontend** (copy `frontend/.env.example` → `frontend/.env`):
- `VITE_API_BASE_URL` — base URL for API; empty string means relative (works with Vite proxy in dev)

## Code Style

- **Prettier**: singleQuote, semi, trailingComma `all`, printWidth 100, tabWidth 2
- **ESLint**: TypeScript strict + stylistic, React hooks rules enforced
- `dist/` and `node_modules/` are excluded from linting

## Current Status

The pipeline is fully mocked — no real AI calls are made. The `ANTHROPIC_API_KEY` is a placeholder for future integration. The architecture in `pipeline/` is designed so each step can be swapped for an AI-backed implementation independently.
