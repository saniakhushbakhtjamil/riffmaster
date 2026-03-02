# RiffMaster — Architecture

## Overview

RiffMaster is a pnpm monorepo with three packages:

```
riffmaster/
├── shared/    @riffmaster/shared  — Zod schemas + TypeScript types
├── backend/   @riffmaster/backend — Express API + AI pipeline
└── frontend/  @riffmaster/frontend — React + Vite + Tailwind UI
```

---

## Request Lifecycle

```
Browser
  └─ ChordForm submits GenerateTabRequest
       └─ api/client.ts: validateRequest → POST /api/generate-tab
            └─ routes/generateTab.ts: validateRequest → runGenerateTabPipeline()
                 ├─ [cache miss] analysis.ts    → Claude API → AnalysisResult    → cache
                 ├─ [cache miss] composition.ts → Claude API → CompositionResult → cache
                 ├─ [cache miss] guitarisation.ts → TabModel → cache
                 └─ renderAsciiTab(tab) → GenerateTabResponse
            └─ validateResponse → JSON
       └─ api/client.ts: validateResponse → GenerateTabResponse
  └─ TabDisplay renders ASCII tab
```

---

## Package Responsibilities

### `@riffmaster/shared`

Single source of truth for data contracts shared between backend and frontend.

- `schemas.ts` — All Zod schemas. If you change a contract, change it here only.
- `types.ts` — TypeScript types inferred from schemas via `z.infer<>`.
- `index.ts` — Re-exports everything.

**Build:** Must be compiled (`pnpm build`) before backend or frontend can run. The `pnpm dev` root command does this automatically.

### `@riffmaster/backend`

Express API server + 3-step AI pipeline.

| Layer | Files | Role |
|-------|-------|------|
| HTTP | `app.ts`, `routes/generateTab.ts` | CORS, body parsing, Zod validation, error handling |
| Pipeline | `pipeline/index.ts` | Orchestrates 3 steps + per-step caching |
| AI Steps | `pipeline/analysis.ts`, `pipeline/composition.ts` | Claude API calls with structured output |
| Mechanical Step | `pipeline/guitarisation.ts` | Assembles `TabModel` from composition notes |
| Services | `services/anthropic.ts`, `services/cache.ts` | Singletons: Anthropic client, cache client |
| Rendering | `tab/renderAsciiTab.ts` | Converts `TabModel` to ASCII string |

### `@riffmaster/frontend`

React SPA. No routing — single page with form → result flow.

| Component | Role |
|-----------|------|
| `App.tsx` | State management, loading/error handling |
| `ChordForm.tsx` | User input with client-side validation |
| `TabDisplay.tsx` | Renders ASCII tab + metadata |
| `api/client.ts` | Typed fetch wrapper with Zod validation |

---

## AI Pipeline

### Model

Both AI steps use `claude-opus-4-6` with `thinking: { type: 'adaptive' }`.

Structured outputs are enforced using `client.messages.parse()` + `zodOutputFormat(schema)` from `@anthropic-ai/sdk/helpers/zod`. Claude's JSON response is automatically validated against the Zod schema.

### Step 1 — Analysis (`pipeline/analysis.ts`)

**Input:** `GenerateTabRequest` (songTitle, artistName, tempo, style?, difficulty?)

**Prompt asks Claude for:**
- The musical key (e.g. "G major", "A minor")
- Capo position (0–12, where 0 = no capo)
- A chord progression of 4–8 chords with beat counts

**Output:** `AnalysisResult`
```typescript
{
  key: string;
  capoPosition: number; // 0–12
  chordProgression: Array<{ chord: string; beats: number }>;
}
```

**Cache key:** `{ songTitle, artistName, tempo }`

---

### Step 2 — Composition (`pipeline/composition.ts`)

**Input:** `AnalysisResult` + `GenerateTabRequest`

**Prompt asks Claude for:**
- Guitar notes across the full chord progression
- One note per beat (or 0.5 for eighth notes)
- Frets that actually form the chords in standard tuning
- A pattern name (e.g. "fingerpicked-arpeggio")

**String index convention (must match this exactly):**

| stringIndex | String | Physical position |
|-------------|--------|-------------------|
| 5 | Low E | 6th string (thickest) |
| 4 | A | 5th string |
| 3 | D | 4th string |
| 2 | G | 3rd string |
| 1 | B | 2nd string |
| 0 | High e | 1st string (thinnest) |

**Output:** `CompositionResult`
```typescript
{
  patternName: string;
  notes: Array<{
    stringIndex: number; // 0–5
    fret: number;        // 0–24
    durationBeats: number; // positive
  }>;
}
```

**Cache key:** stringified `AnalysisResult`

---

### Step 3 — Guitarisation (`pipeline/guitarisation.ts`)

Mechanical step — no AI. Wraps notes into a `TabModel`.

- Sets tuning to standard: `['E', 'A', 'D', 'G', 'B', 'E']`
- Copies `tempo` and `timeSignature` from the original request

**Cache key:** stringified `CompositionResult`

---

## Caching

**File:** `backend/src/services/cache.ts`

Each pipeline step independently checks cache before calling Claude. Cache TTL is 1 hour (3600 seconds) per step.

```
                ┌──────────────────────────────────────┐
Request comes in│ pipeline/index.ts                    │
                │                                      │
                │  key = getAnalysisCacheKey(req)      │
                │  cached = await cache.get(key)       │
                │  if cached → skip Claude call        │
                │  else → runAnalysisStep() → cache    │
                └──────────────────────────────────────┘
```

**Cache backend selection:**
- `REDIS_URL` env var present → `RedisCacheClient` (ioredis)
- `REDIS_URL` absent → `InMemoryCacheClient` (JavaScript Map)

In local development, Redis is not required. Comment out `REDIS_URL` in `.env` to use in-memory cache.

---

## Data Contracts

All schemas are in `shared/src/schemas.ts`. Key types:

```
GenerateTabRequest → pipeline input
GenerateTabResponse → full API response
  ├── tab.ascii: string
  ├── tab.model: TabModel
  ├── metadata: { key, capo, chordProgression, ... }
  └── steps: { analysis, composition, guitarisation }
             each with: name, fromCache, durationMs, output

AnalysisResult    → Step 1 output
CompositionResult → Step 2 output
GuitarisationResult → Step 3 output (contains TabModel)

TabModel → { tuning[6], tempo, notes: TabNote[] }
TabNote  → { stringIndex, fret, durationBeats }
```

---

## Console Logging

When `ANTHROPIC_API_KEY` is active, the backend logs every Claude interaction:

```
[analysis] → sending to Claude:
  model: claude-opus-4-6
  prompt:
    You are a music theory expert...

[analysis] ← received from Claude:
  stop_reason: end_turn
  usage: { input_tokens: 312, output_tokens: 87 }
  parsed_output: { "key": "G major", "capoPosition": 0, ... }
```

---

## Development Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend | 4000 | Express API |
| Frontend | 5173 | Vite dev server |
| Docker (full stack) | 8080 | Nginx reverse proxy |

Frontend Vite dev server proxies `/api/*` → `http://localhost:4000`.
