# Projects Section — UX Spec Mapping

B2B `PROJECTS.md` is the structural reference. Orbit implements the same concepts with English-first code labels and i18n for ru/kk UI.

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

### Overview

Project passport (type, kind, stage, status, location, client, schedule, floors, notes), stage pipeline stepper, budget utilisation, managers.

Stat strip above tabs (progress, tasks, documents, budget left, area/rooms) is shared across all tabs — not duplicated on Overview.

---

## Typical flow

1. **New project** → fill passport, start at P1.
2. **Tasks** → create and assign kanban work.
3. **Documents** → upload ВОР / specs.
4. Advance stage **P2 → P3** as item list and estimate firm up.
5. Project **archives** when all tasks are done; reopens if open work returns.

---

## API

**Projects**
- `GET /projects?withStats=true` — cards with progress, document count, role breakdown
- `GET/PATCH /projects/:id` — passport fields + managers
- `GET/POST/DELETE /projects/:id/documents` — document registry
Task status includes `blocked`.

---

## Constants

See `artifacts/pm-app/src/lib/project-constants.ts` for stages, kinds, document categories, kanban columns.

UI strings: `artifacts/pm-app/src/i18n/locales/{en,ru,kk}.json`.

---

