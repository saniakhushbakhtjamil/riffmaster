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
  └─ ChordForm submits GenerateTabRequest (songTitle + artistName)
       │
       ├─ Phase 1: api/client.ts analyseTab() → POST /api/analyse
       │    └─ routes/analyse.ts: validateRequest → runAnalysisStep() (with cache)
       │         └─ [cache miss] analysis.ts → Claude API → AnalysisResult → cache
       │    └─ AnalysisDisplay renders key, tempo, chords, strumming pattern, guide
       │
       └─ Phase 2: api/client.ts generateTab() → POST /api/generate-tab
            └─ routes/generateTab.ts: validateRequest → runGenerateTabPipeline()
                 ├─ [cache hit]  analysis.ts    → AnalysisResult (from cache)
                 ├─ [cache miss] composition.ts → Claude API → CompositionResult → cache
                 ├─ [cache miss] guitarisation.ts → TabModel → cache
                 └─ renderAsciiTab(tab) → GenerateTabResponse
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
| HTTP | `app.ts`, `routes/analyse.ts`, `routes/generateTab.ts` | CORS, body parsing, Zod validation, error handling |
| Pipeline | `pipeline/index.ts` | Orchestrates 3 steps + per-step caching |
| AI Steps | `pipeline/analysis.ts`, `pipeline/composition.ts` | Claude API calls with structured output |
| Mechanical Step | `pipeline/guitarisation.ts` | Assembles `TabModel` from composition notes |
| Services | `services/anthropic.ts`, `services/cache.ts` | Singletons: Anthropic client, cache client |
| Rendering | `tab/renderAsciiTab.ts` | Converts `TabModel` to ASCII string |

### `@riffmaster/frontend`

React SPA. No routing — single page with form → result flow.

| Component | Role |
|-----------|------|
| `App.tsx` | State management, two-phase loading/error handling |
| `ChordForm.tsx` | User input (song title + artist) with client-side validation |
| `AnalysisDisplay.tsx` | Shows analysis results between phase 1 and phase 2 |
| `TabDisplay.tsx` | Renders ASCII tab + metadata |
| `api/client.ts` | Typed fetch wrapper with Zod validation |

---

## AI Pipeline

### Model

Both AI steps use `claude-opus-4-6` with `thinking: { type: 'adaptive' }`.

Structured outputs use `client.messages.create()` with a system prompt instructing Claude to respond with a single JSON object. The response text block is extracted, `JSON.parse()`d, and validated against the Zod schema at runtime.

> `zodOutputFormat` / `messages.parse()` are not used — they require Zod v4, incompatible with this project's Zod v3.

### Step 1 — Analysis (`pipeline/analysis.ts`)

**Input:** `GenerateTabRequest` (songTitle, artistName, style?, difficulty?)

**Prompt asks Claude for:**
- The musical key (e.g. "G major", "A minor")
- Capo position (0–12, where 0 = no capo)
- Tempo (BPM, 40–240)
- A chord progression of 4–8 chords with beat counts
- A strumming pattern (e.g. "D DU UDU")
- A brief playing guide (how to approach the song)

**Output:** `AnalysisResult`
```typescript
{
  key: string;
  capoPosition: number;    // 0–12
  tempo: number;           // 40–240 BPM
  chordProgression: Array<{ chord: string; beats: number }>;
  strummingPattern: string;
  playingGuide: string;
}
```

**Cache key:** `{ songTitle, artistName }`

---

### Step 2 — Composition (`pipeline/composition.ts`)

**Input:** `AnalysisResult` + `GenerateTabRequest`

**Prompt asks Claude for:**
- Guitar notes as **beat groups** — each group is a time slot with one or more simultaneous notes
- `durationBeats` lives on the group (not individual notes); multiple notes in a group = played simultaneously
- Sum of all `durationBeats` must equal `totalBeats` (derived from the chord progression)
- Style guidance: arpeggio = 1–3 notes per beat in a rolling pattern; strumming = 4–6 strings per beat
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
  beats: Array<{
    durationBeats: number;          // positive — duration of this time slot
    notes: Array<{
      stringIndex: number;          // 0–5
      fret: number;                 // 0–24
    }>;                             // 1+ notes played simultaneously
  }>;
}
```

**Cache key:** stringified `AnalysisResult`

---

### Step 3 — Guitarisation (`pipeline/guitarisation.ts`)

Mechanical step — no AI. Wraps beat groups into a `TabModel`.

- Sets tuning to standard: `['E', 'A', 'D', 'G', 'B', 'E']`
- Uses `tempo` from `AnalysisResult` (not from the original request)
- Copies `timeSignature` from the original request if provided

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

TabModel → { tuning[6], tempo, timeSignature?, beats: BeatGroup[] }
BeatGroup → { durationBeats, notes: BeatNote[] }
BeatNote  → { stringIndex, fret }
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
