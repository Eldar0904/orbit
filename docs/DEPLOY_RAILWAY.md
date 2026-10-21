# Orbit DK on Railway

Status: deployment preparation; no production deployment or database migration has been performed.

Deploy branch `dk-foundation` of `Eldar0904/orbit` using the root Dockerfile. The standalone Express process serves both `/api` and the compiled UI. Vercel is not required. Railway supplies PORT; `railway.json` checks `/api/healthz` before routing traffic. The health endpoint checks the process, not database readiness.

## Configuration

Set these in Railway's protected variables interface; never commit secrets:

- DATABASE_URL: the existing Supabase Postgres connection, after checking the target and migration plan.
- CLERK_SECRET_KEY: the existing Clerk instance secret.
- CLERK_PUBLISHABLE_KEY and VITE_CLERK_PUBLISHABLE_KEY: matching public key from the same instance. The VITE variable is embedded during build; changing it requires rebuilding.
- VITE_CLERK_PROXY_URL=/api/__clerk for the existing production proxy setup. Development Clerk instances should leave this empty.
- CORS_ALLOWED_ORIGINS: the exact new HTTPS origin, and any explicitly retained UI origin.

Use the generated Railway domain or an owned custom domain. Configure the resulting origin and proxy URL in Clerk and verify sign-in and sign-out on that domain. Keep the previous domain until the replacement is verified.

## Database rollout must precede user access

Preserve the existing database. Inspect its schema and take a restorable backup before changes. The DK SQL migration assumes the legacy Orbit tables already exist. The supplied migration and workspace provisioning scripts deliberately support isolated databases only: do not mark a production database as isolated to bypass that guard.

First rehearse against a database copy. A production rollout still needs an explicit production migration procedure, schema verification, and a verified Clerk subject for the first workspace owner. Existing records have no workspace assignment after the additive migration; they require an explicit ownership mapping before they can be exposed. Do not silently assign all legacy data to a new user.

Do not add a migration command to container startup. No Google Sheets credentials or write access are required. Source imports remain staged and unapproved.

## Verification

Before announcing launch, check image build and startup, database connectivity/schema, real Clerk login, workspace membership, the ten-object pilot, deep links, missing API routes, and authorization between users. Confirm that source batches remain unapproved. Docker was unavailable in the preparation environment; image execution must be verified on the host before launch.
