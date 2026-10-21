# DK foundation — implementation handoff

Branch: `dk-foundation`, based on `c75f985ebe337475c9f9b1d7a1fd2a9c20328d62`.

## Included

- Authenticated, explicitly provisioned workspace membership and project grants; old project/task/member/document/dashboard APIs now require scope. Unassigned legacy records stay inaccessible until deliberately adopted. A known Clerk subject is bound explicitly; email or first sign-in does not claim data.
- Workspace selection in the frontend; caches separated/cleared when changing workspace/account. Import review has an additional explicit grant, including for administrators.
- Equipment project creation with ten DK objects, site/room APIs and room entry screen. Room numbers remain text; area is a decimal string/numeric(12,2).
- Explicit KZT/USD/CNY reporting currency and a nullable numeric purchase-budget field. No budget approval endpoint exists yet; unknown budget is shown as unconfirmed. Existing manually entered legacy budgets/currencies are not reinterpreted or converted.
- Strict, bounded JSON source staging, raw value preservation, source-cell issues and stable content deduplication. Re-capturing unchanged content with another timestamp does not create another import. Data can only remain `staged`; there is no source-write, payment-posting or baseline-approval endpoint.
- Audit events for new equipment mutations, including import content hashes, with an append-only database trigger. Formal payment/requirement approvals and full before/after audit coverage of all legacy mutations are later work.
- DK projects cannot auto-archive when tasks finish, accept legacy manual spend updates, or be deleted through the legacy route.
- OpenAPI operations and regenerated React client/validation packages.

## Not yet included

Approved requirements, matching registry, finance-specific roles, object-limited grants, supplier/order/contract/payment ledgers, verified document storage, room edit/version workflows, live Google reads/synchronisation, delivery/stock/installation, acceptance and formal close-out. Import review currently displays the first 100 raw rows with issues and source links; it does not apply mappings or create rooms/approved quantities. New manually entered room passports are explicitly unverified.

No production database/deployment/workbook was accessed or changed. No `.env` or private business snapshot is part of this branch. Example values in tests/preview are synthetic. This is a development foundation, not a production rollout.

## Verification recorded on 21 October 2026

- 18 disposable-PostgreSQL/API tests passed, including migration execution and immutable source/audit triggers.
- Workspace type checking and full production build passed with the existing sandbox's PORT/BASE_PATH configuration. Existing sourcemap and chunk-size warnings remain.
- Browser inspection confirmed the synthetic ten-object directory, decimal room display and staged import-detail view. Clerk sign-in/workspace selection was type-checked, not tested against a live Clerk instance.
- Production bundles were checked for test-auth headers and synthetic fixture identifiers; none were included.
- No production migration/provisioning/legacy adoption has been executed. Root environment files were not copied into this checkout.

## Local checks

```text
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/api-server run test:foundation
pnpm run build
```

The test runner aliases the database to PGlite and exercises actual routes over a disposable localhost server. It clears DATABASE_URL for that child process and never imports the production database connection. Socket access must be allowed locally. Tests cover migration preservation, auth/scope, imports, decimals, project closure, audit and origin policy. These are foundation checks, not the complete operational acceptance suite in the planning specification.

The existing mockup-sandbox build additionally requires `PORT` and `BASE_PATH`; for a full local workspace build set `PORT=5178` and `BASE_PATH=/`. The app/API build passes with those settings. Existing UI sourcemap and large-chunk warnings remain non-blocking.

## Database rollout — isolated development only

1. Restore a reviewed copy of the pre-foundation schema to a new isolated database. Never point the following commands at production. A production deployment needs separate schema inspection, verified backup/restore, legacy assignment and migration review.
2. Set DATABASE_URL to that isolated database and `DK_ISOLATED_DATABASE=confirmed`. No scripts infer or copy a connection string from the existing production checkout.
3. Run `node scripts/migrate-dk.mjs`. It applies the versioned SQL transactionally under a lock and records its checksum. Existing project/member values remain unchanged; workspace fields remain null until adoption. This migration expects the existing Orbit base tables. It is not a fresh-database bootstrap.
4. Explicitly verify a test user's Clerk subject. Run `node scripts/provision-dk-workspace.mjs "DK pilot" "user_VERIFIEDSUBJECT" --import-review` only if that user is authorised to inspect source data. Omit the final flag to deny import review. The script refuses an existing workspace name; it does not silently alter memberships or adopt legacy records.
5. Set Clerk keys for the development instance using untracked environment files. Configure `CORS_ALLOWED_ORIGINS=http://localhost:5173` for a separate local frontend; same-origin production API access is accepted without this override. Do not add wildcard origins.
6. Start the normal API and frontend. Sign in, select the workspace, and use “+ Проект 10 ДК”. This creates a new project with ten sites, not a duplicate of existing live data. Do not click repeatedly if an earlier response was lost; check the project list first.

Adding additional users/project grants is currently an operator-reviewed database operation; a permission-management UI is not included. `workspace_memberships.role` controls access, not the legacy team-card `members.role`. Legacy adoption needs explicit project/member scope review so pre-existing cross-project links cannot leak records. Do not use the legacy `db push-force` workflow with these versioned migrations.

## Prepare private candidates without touching Google

The offline adapter reads the saved discovery JSON and writes review candidates into a new private directory:

```text
python scripts/prepare-dk-candidates.py --snapshot PATH_TO_SAVED_SNAPSHOT --output dk-private-data/capture-001 --captured-at ACTUAL_CAPTURE_TIMESTAMP_WITH_TIMEZONE
```

Use the real original capture timestamp, not the conversion time. If only a date is known, establish provenance first. This adapter covers the object/room registry, central procurement comparison and dated finance candidates; it is not a complete mapping/importer for every tab. All quantities, source costs and payment strings remain unapproved. Output is split below server batch limits. It creates no Google or Orbit network connections. Keep private outputs out of Git; `dk-private-data/` is ignored.

An import-review user can upload each JSON file in the DK tab. Re-uploading identical content returns the existing batch. Source row locations are provenance only, not stable product/business identities; row relocation and cross-batch semantic deduplication need the later mapping registry before operational use. No formula/colour/image extraction is claimed from the captured display-value file.

## Synthetic browser preview

For UI inspection without Clerk/live database, start the fixture API from `artifacts/api-server` with `node tests/preview.mjs`. It binds only 127.0.0.1:8089 and uses disposable in-memory data. Then run Vite with `API_PROXY_TARGET=http://127.0.0.1:8089` on port 5178 and visit `/tests/dk-preview.html`.

The preview entry bypasses Clerk only in an explicit test harness that is not imported by the application/server production entries. It displays a persistent synthetic-data banner. Never deploy the dev server, test fixture or preview entry as an authenticated application. Normal production build uses only index.html and src/index.ts entrypoints.

## Review before the next phase

Confirm the approved quantities/internal budget versus customer revenue sources and the named approvers. Build requirement versions/mappings next, followed by supplier orders and payment evidence workflows. Do not enable operational approvals or import real facts until those rules and permissions are implemented and verified.
