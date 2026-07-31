# Projects Section — UX Spec Mapping

B2B `PROJECTS.md` is the structural reference. Orbit implements the same concepts with English-first code labels and i18n for ru/kk UI.

See also:

- [B2B_REFERENCE.md](./B2B_REFERENCE.md) — full phases, AI roadmap, architecture comparison
- [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) — deployment

---

## B2B → Orbit mapping

| B2B concept | Orbit implementation |
|-------------|---------------------|
| Project cards list | `artifacts/pm-app/src/pages/projects.tsx` — `useListProjects({ withStats: true })` |
| Stage stepper П1–П6 | `PROJECT_STAGES` in `project-constants.ts`, `StageStepper` component, `stages.*` i18n |
| Passport fields | Extended `projects` table + `EditProjectDialog` |
| Managers | `project_managers` junction table, multi-select in edit dialog |
| Tasks kanban | `TasksKanban` — To Do / In Progress / Blocked / Done |
| Documents tab | `DocumentsTab` + `project_documents` table (metadata; storage TBD) |
| Закупки / ИИ-поиск | **Sourcing & Offer** tab — `ProcurementTab` (match items live; suppliers, КП, procurement planned) |
| Overview tab | `OverviewTab` — passport + stage pipeline + budget utilisation |
| Auto-close project | `syncProjectStatus()` when all tasks done → `archived`; reopen on new open work |
| Progress from tasks | `computeProgress()` — no manual % |

---

## Project stages (P1–P6)

| Stage | B2B (RU) | Orbit constant id |
|-------|----------|-------------------|
| P1 | Определение типа проекта | `p1` |
| P2 | Формирование списка наименований | `p2` |
| P3 | Техническое задание и смета | `p3` |
| P4 | Доставка и установка | `p4` |
| P5 | Финансовое закрытие | `p5` |
| P6 | Подписки и постсервис | `p6` |

---

## Project detail tabs

### Tasks

Kanban: todo → in_progress → blocked → done. Drag updates task status. Progress bar = done / total.

### Documents

Per-project registry. Categories: specification, contract, floor plan, invoice, permit, photo, procurement, act, other. File blob storage not yet connected.

### Sourcing & Offer

Four-phase workflow (`procurement-tab.tsx`) backed by the **Knowledge Base**:

1. **Match items** — save project spec list, select workspace catalogs, run multi-catalog match, review top-N results
2. **Find suppliers** — AI supplier search (Gemini when `GEMINI_API_KEY` is set)
3. **Commercial offer** — export CSV from selected matches with margin
4. **Procurement** — planned

### Catalogs (workspace nav)

Import and manage growing catalog sources at `/catalogs`.

### Overview

Project passport (type, kind, stage, status, location, client, schedule, floors, notes), stage pipeline stepper, budget utilisation, managers.

Stat strip above tabs (progress, tasks, documents, budget left, area/rooms) is shared across all tabs — not duplicated on Overview.

---

## Typical flow

1. **New project** → fill passport, start at P1.
2. **Tasks** → create and assign kanban work.
3. **Documents** → upload ВОР / specs.
4. Advance stage **P2 → P3** as item list and estimate firm up.
5. **Sourcing & Offer** → match spec items to catalogs; later supplier search and КП.
6. Project **archives** when all tasks are done; reopens if open work returns.

---

## API

**Projects**
- `GET /projects?withStats=true` — cards with progress, document count, role breakdown
- `GET/PATCH /projects/:id` — passport fields + managers
- `GET/POST/DELETE /projects/:id/documents` — document registry
- Legacy: `GET/POST/DELETE /projects/:id/catalog`, `POST /projects/:id/match`

**Knowledge base (`/kb/*`)**
- `GET/POST/PATCH/DELETE /kb/suppliers`
- `GET/POST/PATCH /kb/sources`
- `POST /kb/sources/:id/import`
- `GET /kb/sources/:id/products`, `GET /kb/products/search`
- `POST /kb/supplier-search`

**Project sourcing**
- `GET/PUT /projects/:id/spec-items`
- `GET/PUT /projects/:id/catalog-links`
- `POST /projects/:id/match-run`
- `GET /projects/:id/match-results`
- `PATCH /projects/:id/match-results/select`
- `POST /projects/:id/commercial-offers/export`

Task status includes `blocked`.

---

## Constants

See `artifacts/pm-app/src/lib/project-constants.ts` for stages, kinds, document categories, kanban columns.

UI strings: `artifacts/pm-app/src/i18n/locales/{en,ru,kk}.json`.

---

## Planned features (from B2B AI roadmap)

Prioritized in [B2B_REFERENCE.md](./B2B_REFERENCE.md#4-ai--product-roadmap-from-b2b-readme):

- **Next:** supplier search, commercial offer generation, document storage
- **Later:** spec completeness checks, estimate comparison, FGOS/SanPiN rules, LLM-assisted Q&A and act drafting
