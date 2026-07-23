# Deploy Orbit to Vercel

Orbit deploys as **one Vercel project**: static frontend + Express API as a serverless function (`/api/*`).

## Before you deploy

1. **Supabase** — production Postgres ready; use the **transaction pooler** URI (port `6543`) for serverless:
   ```
   postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
2. **Clerk** — create a **Production** instance at [dashboard.clerk.com](https://dashboard.clerk.com) and copy `pk_live_...` / `sk_live_...`.
3. **GitHub** — repo pushed to https://github.com/Eldar0904/orbit

## 1. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **Eldar0904/orbit**
3. Confirm settings (should match `vercel.json`):
   - **Framework Preset:** Other
   - **Root Directory:** `.` (repo root)
   - **Build Command:** `pnpm --filter @workspace/pm-app run build`
   - **Output Directory:** `artifacts/pm-app/dist/public`
   - **Install Command:** `pnpm install`

## 2. Environment variables

Add these in Vercel → Project → Settings → Environment Variables (Production + Preview):

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Supabase transaction pooler URI | port `6543`, `?pgbouncer=true` |
| `CLERK_SECRET_KEY` | `sk_live_...` | Production secret key |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Production publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Same as above — needed at **build** time |
| `VITE_CLERK_PROXY_URL` | `/api/__clerk` | Clerk proxy through your domain |
| `NODE_ENV` | `production` | Enables Clerk proxy middleware |
| `LOG_LEVEL` | `info` | Optional |

Do **not** set `VITE_API_URL` when frontend and API share the same Vercel domain (default).

## 3. Clerk dashboard (after first deploy)

1. Note your Vercel URL, e.g. `https://orbit-xxx.vercel.app`
2. Clerk → **Orbit** → **Domains** — add that URL
3. Clerk → **Paths** — ensure sign-in/sign-up URLs match (`/sign-in`, `/sign-up`)

## 4. Deploy

Push to `main` — Vercel auto-deploys if GitHub is connected.

Or deploy from CLI:

```powershell
npm i -g vercel
cd C:\Users\Pine\Documents\PINE\ReplitProjects\SaaS-Task-Manager
vercel --prod
```

## 5. Verify

- `https://your-app.vercel.app` — landing / sign-in
- `https://your-app.vercel.app/api/healthz` — should return `{"status":"ok"}`
- Sign up → Dashboard loads with stats

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on `pnpm` | Ensure Install Command is `pnpm install` |
| API 500 / DB errors | Use Supabase **transaction pooler** (`6543`), not direct `5432` |
| Clerk sign-in fails | Add Vercel domain in Clerk; set `VITE_CLERK_PROXY_URL=/api/__clerk` |
| Blank page after refresh | `vercel.json` SPA rewrite should serve `index.html` |
| API works locally but not Vercel | Check all env vars are set for **Production** |

## Split deployment (optional)

To host the API elsewhere (Railway, Render):

1. Deploy API there with `DATABASE_URL` + Clerk keys
2. On Vercel, set `VITE_API_URL=https://your-api.example.com`
3. Remove or adjust `/api` rewrite in `vercel.json`
