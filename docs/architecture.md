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
                 ├─ [cache hit]  analysis.ts      → AnalysisResult (from cache)
                 ├─                voicing.ts      → ChordVoicingInfo[] (~0ms, no cache)
                 ├─ [cache miss] composition.ts   → Claude API → CompositionResult → cache
                 ├─                validation.ts   → corrected CompositionResult (~0ms, no cache)
                 ├─ [cache miss] guitarisation.ts → TabModel → cache
                 └─ renderAsciiTab(tab) → GenerateTabResponse
            └─ TabDisplay renders ASCII tab + RatingWidget
                 └─ [optional] submitRating() → POST /api/ratings
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
| HTTP | `app.ts`, `routes/analyse.ts`, `routes/generateTab.ts`, `routes/ratings.ts` | CORS, body parsing, Zod validation, error handling |
| Pipeline | `pipeline/index.ts` | Orchestrates all steps + per-step caching |
| AI Steps | `pipeline/analysis.ts`, `pipeline/composition.ts` | Claude API calls with structured output |
| Deterministic Steps | `pipeline/voicing.ts`, `pipeline/validation.ts` | tonal-based chord computation and note correction |
| Mechanical Step | `pipeline/guitarisation.ts` | Assembles `TabModel` from validated beat groups |
| Services | `services/anthropic.ts`, `services/cache.ts`, `services/ratingsStore.ts` | Anthropic client, cache, in-memory rating store |
| Rendering | `tab/renderAsciiTab.ts` | Converts `TabModel` to ASCII string |

### `@riffmaster/frontend`

React SPA. No routing — single page with form → result flow.

| Component | Role |
|-----------|------|
| `App.tsx` | State management, two-phase loading/error handling, tracks current song |
| `ChordForm.tsx` | User input (song title + artist) with client-side validation |
| `AnalysisDisplay.tsx` | Shows analysis results between phase 1 and phase 2 |
| `TabDisplay.tsx` | Renders ASCII tab + metadata + RatingWidget |
| `RatingWidget.tsx` | Star ratings (playability + musicality 1–5) + optional comment |
| `api/client.ts` | Typed fetch wrapper — `analyseTab`, `generateTab`, `submitRating` |

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

### Step 2a — Voicing (`pipeline/voicing.ts`)

**No AI. Pure computation using `tonal`.**

**Input:** `AnalysisResult` (chord progression + capo position)

For each chord in the progression:
1. `Chord.get(chord).notes` → pitch classes (e.g. Em7 → `['E','G','B','D']`)
2. For each of the 6 strings, scan frets 0–4 (relative to capo): compute the sounding note and keep it if it's a chord tone
3. Returns the full list of valid `{ stringIndex, fret, note }` positions

The result is formatted as a human-readable block and injected directly into the composition prompt — Claude sees exactly which frets are valid for each chord and must only use those.

**Output:** `ChordVoicingInfo[]` (not cached — instant, used as prompt context only)

---

### Step 2b — Composition (`pipeline/composition.ts`)

**Input:** `AnalysisResult` + `GenerateTabRequest` + pre-computed voicings

**What changed from v1:** Claude no longer guesses fret positions. The prompt provides a per-chord table of valid `(stringIndex, fret)` positions and instructs Claude to use only those. Claude's role is purely arrangement — which voicing, what rhythm, how to roll the arpeggio.

**Prompt targets intermediate guitarists** with style-specific guidance:
- Arpeggio/fingerstyle: thumb on strings 5/4/3, fingers on 2/1/0, roll from bass upward
- Strumming: bass note on beat 1, strum pattern on remaining beats

**String index convention:**

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
    durationBeats: number;
    notes: Array<{ stringIndex: number; fret: number }>;
  }>;
}
```

**Cache key:** stringified `AnalysisResult`

---

### Step 2c — Validation (`pipeline/validation.ts`)

**No AI. Instant tonal-based post-processing.**

Runs immediately after composition, before caching. Three checks:

| Check | Action |
|-------|--------|
| Note is not a chord tone | Correct to nearest chord tone on same string (scan outward ±1–4 frets); drop if no match found |
| Stretch within a beat > 4 frets | Remove outlier notes closest to the median fret |
| Position jump between beats > 5 frets | Log warning — surfaced in `response.warnings[]` |

Correction count and warnings are logged to stdout and any warnings are included in the API response.

---

### Step 3 — Guitarisation (`pipeline/guitarisation.ts`)

Mechanical step — no AI. Wraps beat groups into a `TabModel`.

- Sets tuning to standard: `['E', 'A', 'D', 'G', 'B', 'E']`
- Uses `tempo` from `AnalysisResult` (not from the original request)
- Copies `timeSignature` from the original request if provided

**Cache key:** stringified `CompositionResult`

---

## Rating System

Used for user research — collecting playability and musicality signal on generated tabs.

**Backend:**
- `services/ratingsStore.ts` — file-backed store. On startup it reads `backend/data/ratings.json` into memory; on every `saveRating()` call it rewrites the file atomically. Survives process restarts. Falls back gracefully if the file is missing or corrupt.
- `backend/data/ratings.json` — the live data file. Gitignored (user data). The `data/` directory is tracked via `.gitkeep` so it exists on a fresh clone.
- `POST /api/ratings` — saves a rating (see API reference)
- `GET /api/ratings/:songTitle/:artistName` — returns all ratings for a song

**Frontend:**
- `RatingWidget.tsx` renders below the ASCII tab once generation is complete
- Two independent star selectors (1–5): **Playability** and **Musicality**
- Optional free-text comment (max 500 chars)
- On submit → `client.ts` `submitRating()` → `POST /api/ratings`
- Shows a confirmation message on success; errors surface inline

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

When `ANTHROPIC_API_KEY` is active, the backend logs every Claude interaction and pipeline event:

```
[analysis] → sending to Claude:
  model: claude-opus-4-6
  ...
[analysis] ← received from Claude:
  stop_reason: end_turn
  usage: { input_tokens: 312, output_tokens: 87 }
  parsed_output: { "key": "G major", "capoPosition": 0, ... }

[composition] → sending to Claude:
  style: arpeggio | totalBeats: 16
  voicings computed for 4 chords
[composition] ← received from Claude:
  patternName: fingerpicked-arpeggio
  beats count: 32

[validation] corrections: 2, warnings: 0
[pipeline] validation corrected 2 note(s)

[ratings] saved: 1709384400000-ab3f2c — Wonderwall by Oasis — playability:4 musicality:5
```

---

## Development Ports

| Service | Port | Notes |
|---------|------|-------|
| Backend | 4000 | Express API |
| Frontend | 5173 | Vite dev server |
| Docker (full stack) | 8080 | Nginx reverse proxy |

Frontend Vite dev server proxies `/api/*` → `http://localhost:4000`.
