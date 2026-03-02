# RiffMaster — API Reference

Base URL (local dev): `http://localhost:4000`

---

## POST `/api/generate-tab`

Runs the 3-step AI pipeline and returns an ASCII guitar tab.

### Request

**Content-Type:** `application/json`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `songTitle` | string | yes | 1–200 chars | Song name |
| `artistName` | string | yes | 1–200 chars | Artist/band name |
| `tempo` | integer | yes | 40–220 | Tempo in BPM |
| `timeSignature` | string | no | — | e.g. `"4/4"` |
| `style` | string | no | `"strumming"` \| `"arpeggio"` \| `"fingerstyle"` | Playing style hint for Claude |
| `difficulty` | string | no | `"beginner"` \| `"intermediate"` \| `"advanced"` | Complexity hint for Claude |

**Example:**
```json
{
  "songTitle": "Wonderwall",
  "artistName": "Oasis",
  "tempo": 90,
  "style": "arpeggio",
  "difficulty": "beginner"
}
```

---

### Response

**Content-Type:** `application/json`
**Status:** `200 OK`

```typescript
{
  tab: {
    ascii: string;      // Rendered ASCII tab (6 lines, one per string)
    model: {
      tuning: [string, string, string, string, string, string]; // e.g. ["E","A","D","G","B","E"]
      tempo: number;
      timeSignature?: string;
      notes: Array<{
        stringIndex: number;    // 0 = high e, 5 = low E
        fret: number;           // 0–24
        durationBeats: number;  // positive, e.g. 1.0 or 0.5
      }>;
    };
  };
  metadata: {
    songTitle: string;
    artistName: string;
    tempo: number;
    key: string;              // e.g. "G major"
    capoPosition: number;     // 0–12 (0 = no capo)
    chordProgression: Array<{
      chord: string;          // e.g. "Am"
      beats: number;          // beats per chord
    }>;
    createdAt: string;        // ISO 8601
  };
  steps: {
    analysis: {
      name: "analysis";
      fromCache: boolean;
      durationMs: number;
      output: {
        key: string;
        capoPosition: number;
        chordProgression: Array<{ chord: string; beats: number }>;
      };
    };
    composition: {
      name: "composition";
      fromCache: boolean;
      durationMs: number;
      output: {
        patternName: string;
        notes: Array<{ stringIndex: number; fret: number; durationBeats: number }>;
      };
    };
    guitarisation: {
      name: "guitarisation";
      fromCache: boolean;
      durationMs: number;
      output: {
        tab: { tuning: string[]; tempo: number; notes: TabNote[] };
      };
    };
  };
  warnings?: string[];
}
```

**Example response (abbreviated):**
```json
{
  "tab": {
    "ascii": "e|--0---2---3---|\nB|--1---3---0---|\n...",
    "model": {
      "tuning": ["E", "A", "D", "G", "B", "E"],
      "tempo": 90,
      "notes": [
        { "stringIndex": 1, "fret": 0, "durationBeats": 1 },
        { "stringIndex": 2, "fret": 0, "durationBeats": 1 }
      ]
    }
  },
  "metadata": {
    "songTitle": "Wonderwall",
    "artistName": "Oasis",
    "tempo": 90,
    "key": "F# minor",
    "capoPosition": 2,
    "chordProgression": [
      { "chord": "Em7", "beats": 4 },
      { "chord": "G", "beats": 4 },
      { "chord": "Dsus4", "beats": 4 },
      { "chord": "A7sus4", "beats": 4 }
    ],
    "createdAt": "2026-03-02T10:00:00.000Z"
  },
  "steps": {
    "analysis":     { "name": "analysis",     "fromCache": false, "durationMs": 3210, "output": {...} },
    "composition":  { "name": "composition",  "fromCache": false, "durationMs": 5840, "output": {...} },
    "guitarisation":{ "name": "guitarisation","fromCache": false, "durationMs": 1,    "output": {...} }
  }
}
```

---

### Error Responses

| Status | Cause | Body |
|--------|-------|------|
| `400` | Invalid request body | `{ "error": "Invalid request: <details>" }` |
| `500` | Pipeline error / Claude API error | `{ "error": "<message>" }` |

---

## GET `/health`

Liveness check.

**Response:** `200 OK`
```json
{ "status": "ok" }
```

---

## Caching Behaviour

The response includes `fromCache: boolean` per step. On a cache hit, `durationMs` will be near zero and the Claude API is not called.

Cache TTL is **1 hour** per step. Cache is keyed independently per step:

| Step | Cache key inputs |
|------|-----------------|
| analysis | songTitle + artistName + tempo |
| composition | full AnalysisResult |
| guitarisation | full CompositionResult |

To bypass the cache (e.g. during testing), restart the backend — the in-memory cache is cleared on restart.
