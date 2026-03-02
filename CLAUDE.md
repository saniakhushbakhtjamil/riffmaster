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
`POST /api/generate-tab` → `runGenerateTabPipeline()` → four sequential steps:

1. **analysis.ts** — calls `claude-opus-4-6` with adaptive thinking; returns key, capo position, tempo (BPM), chord progression, strumming pattern, and playing guide
2. **voicing.ts** — deterministic (no AI); uses `tonal` to compute chord tones and map every valid `(stringIndex, fret)` pair per chord within frets 0–4 of the capo position. Results are passed directly to the composition prompt.
3. **composition.ts** — calls `claude-opus-4-6`; receives pre-computed voicing positions per chord and must only use those frets. Returns beat groups tuned for the chosen style (arpeggio / strumming) targeting intermediate guitarists.
4. **validation.ts** — deterministic (no AI); tonal-based post-processing: corrects notes that are not chord tones (nearest fret on same string), trims stretches > 4 frets, logs position jumps > 5 frets. Runs in ~0ms.
5. **guitarisation.ts** — mechanical wrapper: packages validated beat groups into a `TabModel` with standard tuning (E-A-D-G-B-E) and tempo from analysis.

Steps 1, 3, and 5 are independently cached (1-hour TTL) by `services/cache.ts` (Redis or in-memory Map). Voicing and validation are pure functions — they are not cached separately.

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
- `routes/generateTab.ts` — validates request, runs full pipeline, returns `GenerateTabResponse`
- `routes/ratings.ts` — `POST /api/ratings` (save rating), `GET /api/ratings/:song/:artist` (retrieve)
- `services/ratingsStore.ts` — in-memory rating store (sufficient for research phase)

### Frontend Data Flow
Two-phase flow:
1. `ChordForm` → `client.ts` `analyseTab()` → `POST /api/analyse` → `AnalysisDisplay` (shows key, tempo, chords, strumming pattern, playing guide)
2. `client.ts` `generateTab()` → `POST /api/generate-tab` → `TabDisplay` (shows ASCII tab + `RatingWidget`)

After the tab is displayed, `RatingWidget` lets the user rate playability and musicality (1–5 stars each) with an optional comment. Ratings are submitted via `client.ts` `submitRating()` → `POST /api/ratings`.

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

The backend logs all Claude API interactions and pipeline events to stdout:

```
[analysis] → sending to Claude:
[analysis] ← received from Claude:   # stop_reason, usage, raw text preview

[composition] → sending to Claude:   # style, totalBeats, voicings count
[composition] ← received from Claude:

[validation] corrections: N, warnings: M
[pipeline] validation corrected N note(s)

[ratings] saved: <id> — <song> by <artist> — playability:N musicality:N
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
| `backend/src/services/ratingsStore.ts` | In-memory rating store (playability + musicality) |
| `backend/src/routes/analyse.ts` | POST /api/analyse — analysis-only endpoint |
| `backend/src/routes/generateTab.ts` | POST /api/generate-tab — full pipeline endpoint |
| `backend/src/routes/ratings.ts` | POST /api/ratings, GET /api/ratings/:song/:artist |
| `backend/src/pipeline/analysis.ts` | Step 1 — Claude: key, tempo, capo, chords, strumming, playing guide |
| `backend/src/pipeline/voicing.ts` | Step 2a — tonal: chord → tones → valid fret positions per string |
| `backend/src/pipeline/composition.ts` | Step 2b — Claude: beat groups using pre-computed voicing positions |
| `backend/src/pipeline/validation.ts` | Step 2c — tonal: correct non-chord tones, trim stretches, log jumps |
| `backend/src/pipeline/guitarisation.ts` | Step 3 — mechanical: TabModel assembly from validated beat groups |
| `backend/src/pipeline/index.ts` | Pipeline orchestrator + per-step caching |
| `backend/src/tab/renderAsciiTab.ts` | TabModel → ASCII string |
| `frontend/src/components/ChordForm.tsx` | Input form (song title + artist) |
| `frontend/src/components/AnalysisDisplay.tsx` | Shows analysis results between the two API phases |
| `frontend/src/components/TabDisplay.tsx` | ASCII tab output + RatingWidget |
| `frontend/src/components/RatingWidget.tsx` | Star rating UI (playability + musicality + comment) |
| `frontend/src/api/client.ts` | Typed API client — analyseTab, generateTab, submitRating |

## Data Model — Beat Groups

The composition and tab model use a **beat-group** structure rather than a flat note list:

```
TabModel.beats: BeatGroup[]
  BeatGroup { durationBeats: number; notes: BeatNote[] }
  BeatNote  { stringIndex: number; fret: number }
```

Multiple `BeatNote` entries in a single `BeatGroup` are played **simultaneously** (chords, arpeggios). `durationBeats` applies to the whole group. The renderer (`renderAsciiTab.ts`) inserts `|` bar separators based on the `timeSignature` numerator and aligns columns by the widest fret number in each group.

## Dependencies of Note

- `tonal` (backend) — music theory library. Used in `voicing.ts` (chord tone computation) and `validation.ts` (note correction). No API calls — pure computation.
- `@anthropic-ai/sdk` — Claude API. Used in analysis and composition steps only.

## Current Status

- v1.0.0 tagged on `main` — two-phase frontend, beat-group composition model
- Active development on `feature/v2`:
  - tonal-powered voicing pre-computation (chord accuracy guaranteed)
  - tonal-based post-composition validation (instant, auto-corrects wrong frets)
  - In-app rating system (playability + musicality) for user research
- Guitarisation is mechanical (no AI). Redis is optional — in-memory cache used by default in local dev.
