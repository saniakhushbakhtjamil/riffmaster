# AI Guitar Composer Monorepo

Full-stack TypeScript monorepo for an AI-assisted guitar tab generator. The app exposes a web UI for entering a song and artist, then runs a mocked 3-step pipeline (analysis → composition → guitarisation) to return beginner-friendly guitar tabs.

## Packages

- `frontend/` – React + Vite + Tailwind UI, calls the backend `/api/generate-tab` endpoint.
- `backend/` – Node + Express service with the pipeline orchestration, caching, and ASCII tab rendering.
- `shared/` – Zod schemas and shared TypeScript types for requests, responses, and tab models.
- `deploy/` – Nginx config for containerised deployment.

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install dependencies

```bash
pnpm install
```

### Environment variables

- `backend/.env.example` – copy to `backend/.env` and adjust as needed:
  - `PORT` – backend HTTP port (default 4000).
  - `ANTHROPIC_API_KEY` – placeholder for future AI integration (not used yet).
  - `REDIS_URL` – optional Redis instance for caching (defaults to in-memory cache if omitted).
- `frontend/.env.example` – copy to `frontend/.env` if you need an explicit API base URL:
  - `VITE_API_BASE_URL` – base URL for API requests (empty by default; the dev server proxy handles `/api`).

### Run in development

In the repo root:

```bash
pnpm dev
```

This will:

- Build the shared package.
- Start the backend on `http://localhost:4000`.
- Start the frontend Vite dev server on `http://localhost:5173` with a proxy to `/api`.

### Build

```bash
pnpm build
```

Builds `shared`, then `backend`, then `frontend`.

### Lint & format

```bash
pnpm lint
pnpm format
```

### Docker workflow

To build and run the full stack (frontend, backend, Redis, Nginx) using Docker:

```bash
pnpm docker:build
pnpm docker:up
```

Then open `http://localhost:8080` in your browser.

Services:

- `frontend` – built React/Vite app served by Nginx.
- `backend` – Express API at `/api`.
- `redis` – cache backend (optional; falls back to in-memory if unavailable).
- `nginx` – reverse proxy routing `/` to frontend and `/api` to backend.

## API: `POST /api/generate-tab`

The backend exposes a single endpoint for now:

```http
POST /api/generate-tab
Content-Type: application/json
```

**Request body** (validated by Zod in `shared`):

```json
{
  "songTitle": "Wonderwall",
  "artistName": "Oasis",
  "tempo": 90
}
```

**Response body** (also validated by shared Zod schema):

```json
{
  "tab": {
    "ascii": "ASCII TAB HERE",
    "model": {
      "tuning": ["E", "A", "D", "G", "B", "E"],
      "tempo": 90,
      "timeSignature": "4/4",
      "notes": [
        {
          "stringIndex": 5,
          "fret": 3,
          "durationBeats": 1
        }
      ]
    }
  },
  "metadata": {
    "songTitle": "Wonderwall",
    "artistName": "Oasis",
    "tempo": 90,
    "key": "C major",
    "capoPosition": 0,
    "chordProgression": [
      { "chord": "C", "beats": 4 }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "steps": {
    "analysis": {
      "name": "analysis",
      "fromCache": false,
      "durationMs": 5,
      "output": {
        "key": "C major",
        "capoPosition": 0,
        "chordProgression": [
          { "chord": "C", "beats": 4 }
        ]
      }
    },
    "composition": {
      "name": "composition",
      "fromCache": false,
      "durationMs": 3,
      "output": {
        "patternName": "beginner-arpeggio",
        "notes": []
      }
    },
    "guitarisation": {
      "name": "guitarisation",
      "fromCache": false,
      "durationMs": 2,
      "output": {
        "tab": {
          "tuning": ["E", "A", "D", "G", "B", "E"],
          "tempo": 90,
          "timeSignature": "4/4",
          "notes": []
        }
      }
    }
  },
  "warnings": []
}
```

Currently, the pipeline is fully mocked: it deterministically generates a simple chord progression, pattern, and tab based only on the input text. No real AI calls are made yet.

## Frontend behaviour

- Simple form to enter **song title**, **artist**, and **tempo**.
- On submit, calls `/api/generate-tab` via `frontend/src/api/client.ts`.
- Displays the returned ASCII tab and basic metadata using `TabDisplay`.

This scaffold is designed for easy future integration of real AI calls in the backend pipeline and richer UI features on the frontend.

