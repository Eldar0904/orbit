# Local development (Windows)

## Prerequisites

- Node.js 24+
- pnpm (`npm install -g pnpm`)
- PostgreSQL (local or Docker)

## Setup

1. Copy environment variables:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item .env.example artifacts\pm-app\.env.local
   ```

   Fill in `DATABASE_URL` and Clerk keys from your [Clerk dashboard](https://dashboard.clerk.com).

2. Install dependencies:

   ```powershell
   pnpm install
   ```

3. Push database schema:

   ```powershell
   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orbit"
   pnpm --filter @workspace/db run push
   ```

4. Regenerate API client after OpenAPI changes:

   ```powershell
   pnpm --filter @workspace/api-spec run codegen
   ```

## Run

Terminal 1 — API (port 8080):

```powershell
$env:NODE_ENV="development"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orbit"
pnpm --filter @workspace/api-server run dev
```

Terminal 2 — Frontend:

```powershell
pnpm --filter @workspace/pm-app run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

## Typecheck

```powershell
pnpm run typecheck
```
