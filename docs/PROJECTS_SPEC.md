# Projects Section — UX Spec Mapping

B2B `PROJECTS.md` is structural reference only. Orbit uses English labels and existing UI patterns.

## B2B → Orbit mapping

| B2B concept | Orbit implementation |
|-------------|---------------------|
| Project cards list | `artifacts/pm-app/src/pages/projects.tsx` — `useListProjects({ withStats: true })` |
| Stage stepper П1–П6 | `PROJECT_STAGES` in `lib/project-constants.ts`, `StageStepper` component |
| Passport fields | Extended `projects` table + `EditProjectDialog` |
| Managers | `project_managers` junction table, multi-select in edit dialog |
| Tasks kanban | `TasksKanban` — To Do / In Progress / Blocked / Done |
| Documents tab | `DocumentsTab` + `project_documents` table (metadata; storage TBD) |
| Procurement tab | Existing `ProcurementTab` |
| Overview tab | `OverviewTab` — passport + budget utilisation |
| Auto-close project | `syncProjectStatus()` when all tasks done → `archived`; reopen on new open work |
| Progress from tasks | `computeProgress()` — no manual % |

## API

- `GET /projects?withStats=true` — cards with progress, document count, role breakdown
- `GET/PATCH /projects/:id` — passport fields + managers
- `GET/POST/DELETE /projects/:id/documents` — document registry
- Task status includes `blocked`

## Constants

See `artifacts/pm-app/src/lib/project-constants.ts` for stages, kinds, document categories, kanban columns.
