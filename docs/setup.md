# RiffMaster — Setup Guide

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Configure environment

Copy the backend example env file and add your API key:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=4000
ANTHROPIC_API_KEY=sk-ant-...   # Your key from console.anthropic.com
# REDIS_URL=redis://localhost:6379   # Optional — comment out to use in-memory cache
ALLOWED_ORIGIN=http://localhost:5173
```

The frontend doesn't need configuration for local dev (the Vite proxy handles `/api` routing).

---

## 3. Start development servers

```bash
pnpm dev
```

This:
1. Builds `@riffmaster/shared` (TypeScript compilation)
2. Starts the backend at `http://localhost:4000` (tsx hot-reload)
3. Starts the frontend at `http://localhost:5173` (Vite)

Open `http://localhost:5173` in your browser.

---

## 4. Test it

Enter a song title, artist, and tempo, then click **Generate Tab**.

The backend terminal will print the prompts sent to Claude and the structured responses received.

---

## Optional: Redis Cache

By default, the cache is in-memory (resets on server restart). To use Redis:

1. Start Redis: `brew install redis && redis-server` (macOS)
2. Uncomment `REDIS_URL` in `backend/.env`:
   ```
   REDIS_URL=redis://localhost:6379
   ```
3. Restart `pnpm dev`

---

## Production Build

```bash
pnpm build
```

Outputs:
- `backend/dist/` — compiled backend (run with `node backend/dist/index.js`)
- `frontend/dist/` — static frontend assets

---

## Docker

Build and run the full stack in Docker (Nginx on port 8080):

```bash
pnpm docker:build
pnpm docker:up
```

Open `http://localhost:8080`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ANTHROPIC_API_KEY is not set` | Add key to `backend/.env` |
| `[ioredis] Unhandled error event: ECONNREFUSED` | Redis not running — comment out `REDIS_URL` in `.env` |
| `Backend listening` never appears | Check `backend/.env` exists; check Node version >= 20 |
| Tab request returns 500 | Check backend terminal for Claude API error details |
| `Cannot find module '@riffmaster/shared'` | Run `pnpm build` in `shared/` or `pnpm install` from root |
