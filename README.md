# PINE B2B

PINE B2B is a project management workspace for fitout and construction teams. Track projects through staged delivery (P1–P6), assign tasks, manage team workload, register documents, and run the sourcing workflow (catalog matching → suppliers → commercial offer → procurement).

Originally exported from [Replit](https://replit.com); evolved from the **B2B Fitout Dashboard** prototype. See [docs/B2B_REFERENCE.md](./docs/B2B_REFERENCE.md) for phase definitions, AI roadmap, and architecture mapping.

## Features

- **Dashboard** — project and task stats, completion rate, recent activity feed
- **Projects** — rich project cards with progress, P1–P6 stage stepper, budget and deadline stats
- **Catalogs** — workspace knowledge base: import catalogs, manage suppliers, growing product library
- **Project detail** — Tasks (kanban), Documents, Sourcing & Offer (spec matching, AI suppliers, КП export), Overview (project passport)
- **All Tasks** — cross-project task list with filters
- **Team** — add members, view workload by status
- **Auth** — sign-in / sign-up via [Clerk](https://clerk.com)

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript |
| Frontend | React 19, Vite, Wouter, TanStack Query, Tailwind CSS 4 |
| API | Express 5, OpenAPI-first (Orval codegen) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |

## Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- PostgreSQL ([Supabase](https://supabase.com) or local)
- Clerk application ([dashboard.clerk.com](https://dashboard.clerk.com))

## Quick start

See **[LOCAL_DEV.md](./LOCAL_DEV.md)** for full Windows setup.

```powershell
# 1. Clone and install
git clone https://github.com/Eldar0904/orbit.git
cd orbit
pnpm install

# 2. Environment (copy templates, then fill in secrets)
Copy-Item .env.example .env
# Edit .env: DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
# Edit artifacts/pm-app/.env.local: VITE_CLERK_PUBLISHABLE_KEY

# 3. Create database tables
pnpm --filter @workspace/db run push

# 4. Run (two terminals)
pnpm --filter @workspace/api-server run dev   # http://localhost:8080
pnpm --filter @workspace/pm-app run dev       # http://localhost:5173
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | root `.env` | PostgreSQL connection (Supabase or local) |
| `CLERK_SECRET_KEY` | root `.env` | Clerk server key |
| `CLERK_PUBLISHABLE_KEY` | root `.env` | Clerk publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | `artifacts/pm-app/.env.local` | Same publishable key for the frontend |

Never commit `.env` or `.env.local` — they are in `.gitignore`.

## Project structure

```
SaaS-Task-Manager/
├── artifacts/
│   ├── pm-app/          # React frontend (Orbit UI)
│   └── api-server/      # Express API
├── lib/
│   ├── api-spec/        # OpenAPI spec (source of truth)
│   ├── api-client-react/# Generated React Query hooks
│   ├── api-zod/         # Generated Zod validators
│   └── db/              # Drizzle schema + migrations
├── docs/
│   ├── PROJECTS_SPEC.md # Projects section UX spec
│   └── B2B_REFERENCE.md # B2B prototype phases, roadmap, architecture
├── .env.example
├── LOCAL_DEV.md
└── replit.md            # Replit deployment notes
```

## Common commands

```powershell
pnpm run typecheck                              # Typecheck all packages
pnpm run build                                  # Build all packages
pnpm --filter @workspace/api-spec run codegen   # Regenerate API client after OpenAPI changes
pnpm --filter @workspace/db run push            # Push schema to Postgres (dev)
```

## Documentation

- [LOCAL_DEV.md](./LOCAL_DEV.md) — local setup on Windows
- [docs/DEPLOY_VERCEL.md](./docs/DEPLOY_VERCEL.md) — deploy to Vercel (frontend + API)
- [docs/PROJECTS_SPEC.md](./docs/PROJECTS_SPEC.md) — projects section fields, tabs, and stages
- [docs/B2B_REFERENCE.md](./docs/B2B_REFERENCE.md) — B2B prototype phases, AI roadmap, and Orbit mapping
- [replit.md](./replit.md) — architecture notes and gotchas

## License

MIT
