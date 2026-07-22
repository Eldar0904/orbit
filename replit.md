# Orbit — Project Management App

A B2B SaaS project management tool for small startup teams to track tasks, assign owners, set deadlines, and view progress across projects.

## Run & Operate

See [LOCAL_DEV.md](./LOCAL_DEV.md) for Windows local setup (env, Postgres, two-terminal run).

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/pm-app run dev` — run the React frontend (served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle ORM table definitions (projects, tasks, members, activity)
- `artifacts/api-server/src/routes/` — Express route handlers (projects, tasks, members, dashboard)
- `artifacts/pm-app/src/` — React frontend (pages: Dashboard, Projects, Project Detail, All Tasks, Team)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — generated Zod validation schemas (do not edit manually)

## Architecture decisions

- OpenAPI-first: all endpoints defined in `openapi.yaml`, codegen produces typed hooks and validators
- Activity log: all task/project creates and updates write to the `activity` table for the dashboard feed
- Tasks include joined `assignee` and `project` objects on all list/get responses (left joins)
- Dates stored as `date` type in DB; passed as ISO date strings through the API

## Product

- **Dashboard** — live summary stats (projects, tasks, completion rate, overdue), recent activity feed
- **Projects** — project list with color codes and create dialog; per-project detail with progress ring and task management
- **All Tasks** — cross-project task table with status/priority/project filtering
- **Team** — member cards with per-member workload breakdown (task counts by status)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any change to `lib/db/src/schema/`, run `pnpm run typecheck:libs` before typechecking artifact packages, or route imports will show "no exported member" errors
- After any change to `lib/api-spec/openapi.yaml`, run codegen before using updated types
- Do not use `format: email` in the OpenAPI spec — Orval generates `zod.email()` which doesn't exist in zod/v4; just use `type: string`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
