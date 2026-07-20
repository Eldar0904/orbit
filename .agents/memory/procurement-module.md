---
name: Procurement module architecture
description: How the Items & Matching procurement module is wired into the PM platform.
---

## Rule
Catalog is stored per-project as JSONB in `project_catalogs` table. Matching runs server-side in the API. Frontend parses CSV/Excel client-side with `xlsx`, then POSTs parsed items as JSON.

## Why
User chose per-project catalogs that can later grow into a global DB. JSONB avoids a separate items table for now. Server-side matching keeps the algorithm consistent and avoids shipping sklearn-equivalent logic as a large client bundle.

## How to apply
- `POST /api/projects/:id/catalog` — body: `{ filename, items: CatalogItem[] }` (upsert, one catalog per project)
- `POST /api/projects/:id/match` — body: `{ items: string[] }` — returns `{ projectId, results: MatchResult[] }`
- Matching utility: `artifacts/api-server/src/lib/matcher.ts` — Jaccard + char 3-grams + word n-grams, thresholds 55% matched / 30% partial
- Frontend component: `artifacts/pm-app/src/components/procurement-tab.tsx`
- Tab strip lives in `artifacts/pm-app/src/pages/project-detail.tsx` — tabs: Tasks | Procurement
- DB schema: `lib/db/src/schema/catalogs.ts` → `projectCatalogsTable`
- API route: `artifacts/api-server/src/routes/procurement.ts`

## Future: global catalog
When ready to federate per-project catalogs into a shared global DB, add a `catalog_items` table and a fallback query chain: project catalog → global catalog.
