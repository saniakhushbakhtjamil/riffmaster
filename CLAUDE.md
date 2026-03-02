# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RiffMaster is a full-stack TypeScript monorepo for an AI-assisted guitar tab generator. Users input a song title and artist; the app runs a 3-step pipeline (analysis → composition → guitarisation) and returns an ASCII guitar tab.

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

Key types: `GenerateTabRequest`, `GenerateTabResponse`, `TabModel`, `BeatGroup`, `BeatNote`, `AnalysisResult`, `CompositionResult`, `GuitarisationResult`.

### Backend Pipeline (`backend/src/pipeline/`)
`POST /api/generate-tab` → `runGenerateTabPipeline()` → three sequential steps:

1. **analysis.ts** — calls `claude-opus-4-6` with adaptive thinking; returns key, capo position, tempo (BPM), chord progression, strumming pattern, and playing guide for the song
2. **composition.ts** — calls `claude-opus-4-6` with adaptive thinking; returns **beat groups** (`{ durationBeats, notes: [{ stringIndex, fret }] }`) — multiple notes in one group are played simultaneously
3. **guitarisation.ts** — mechanical wrapper: packages beat groups into a `TabModel` with standard tuning (E-A-D-G-B-E) and tempo from the analysis result

Each step's result is independently cached (1-hour TTL) by `services/cache.ts`, which transparently uses Redis (`REDIS_URL` env) or falls back to an in-memory Map.

ASCII rendering is a separate utility: `tab/renderAsciiTab.ts`.

### Anthropic Client (`backend/src/services/anthropic.ts`)
Singleton factory — creates one `Anthropic` instance per process. Throws clearly if `ANTHROPIC_API_KEY` is missing.

### Structured Outputs
Both AI steps use `client.messages.create()` with `thinking: { type: 'adaptive' }`. The system prompt instructs Claude to respond with a single JSON object. The response text block is extracted, `JSON.parse()`d, and validated against the Zod schema at runtime.

> Note: `zodOutputFormat` / `messages.parse()` from the SDK are not used — they require Zod v4 (`z.toJSONSchema()`), which is incompatible with the Zod v3 used in this project.

### Backend Entry (`backend/src/`)
- `index.ts` — loads `.env`, starts server
- `app.ts` — Express app factory, attaches CORS and routes
- `routes/analyse.ts` — validates request, runs only the analysis step, returns `AnalysisResult`
- `routes/generateTab.ts` — validates request, runs full 3-step pipeline, returns `GenerateTabResponse`

### Frontend Data Flow
Two-phase flow:
1. `ChordForm` → `client.ts` `analyseTab()` → `POST /api/analyse` → `AnalysisDisplay` (shows key, tempo, chords, strumming pattern, playing guide)
2. `client.ts` `generateTab()` → `POST /api/generate-tab` → `TabDisplay` (shows ASCII tab)

Since both endpoints use the same analysis cache key, the Claude call for analysis only happens once per unique song+artist pair. The Vite dev server proxies `/api/*` to `http://localhost:4000`.

## Environment Variables

**Backend** (`backend/.env`):
- `PORT` — default `4000`
- `REDIS_URL` — if absent or commented out, in-memory cache is used (Redis not required for local dev)
- `ALLOWED_ORIGIN` — CORS origin, default `*`
- `ANTHROPIC_API_KEY` — **required** — used by analysis and composition pipeline steps

**Frontend** (`frontend/.env`):
- `VITE_API_BASE_URL` — base URL for API; empty string means relative (works with Vite proxy in dev)

## Console Logging

The backend logs all Claude API interactions to stdout:

```
[analysis] → sending to Claude:    # prompt sent
[analysis] ← received from Claude: # stop_reason, usage, parsed_output

[composition] → sending to Claude:
[composition] ← received from Claude:
```

## Code Style

- **Prettier**: singleQuote, semi, trailingComma `all`, printWidth 100, tabWidth 2
- **ESLint**: TypeScript strict + stylistic, React hooks rules enforced
- `dist/` and `node_modules/` are excluded from linting

## Key Files

| File | Purpose |
|------|---------|
| `shared/src/schemas.ts` | All Zod schemas (single source of truth) |
| `shared/src/types.ts` | TypeScript types inferred from schemas |
| `backend/src/services/anthropic.ts` | Singleton Anthropic client |
| `backend/src/services/cache.ts` | Dual in-memory/Redis cache, 1h TTL |
| `backend/src/routes/analyse.ts` | POST /api/analyse — analysis-only endpoint |
| `backend/src/routes/generateTab.ts` | POST /api/generate-tab — full pipeline endpoint |
| `backend/src/pipeline/analysis.ts` | Step 1 — Claude: key, tempo, capo, chords, strumming, playing guide |
| `backend/src/pipeline/composition.ts` | Step 2 — Claude: beat groups (simultaneous notes per time slot) |
| `backend/src/pipeline/guitarisation.ts` | Step 3 — mechanical: TabModel assembly from beat groups |
| `backend/src/pipeline/index.ts` | Pipeline orchestrator + per-step caching |
| `backend/src/tab/renderAsciiTab.ts` | TabModel → ASCII string |
| `frontend/src/components/ChordForm.tsx` | Input form (song title + artist) |
| `frontend/src/components/AnalysisDisplay.tsx` | Shows analysis results between the two API phases |
| `frontend/src/components/TabDisplay.tsx` | ASCII tab output display |
| `frontend/src/api/client.ts` | Typed API client with Zod validation |

## Data Model — Beat Groups

The composition and tab model use a **beat-group** structure rather than a flat note list:

```
TabModel.beats: BeatGroup[]
  BeatGroup { durationBeats: number; notes: BeatNote[] }
  BeatNote  { stringIndex: number; fret: number }
```

Multiple `BeatNote` entries in a single `BeatGroup` are played **simultaneously** (chords, arpeggios). `durationBeats` applies to the whole group. The renderer (`renderAsciiTab.ts`) inserts `|` bar separators based on the `timeSignature` numerator and aligns columns by the widest fret number in each group.

## Current Status

The pipeline uses real Claude API calls (`claude-opus-4-6` with adaptive thinking) for the analysis and composition steps. Guitarisation is mechanical. Redis is optional — in-memory cache is used by default in local dev.
