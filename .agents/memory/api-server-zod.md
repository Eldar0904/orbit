---
name: Zod in API server
description: How to use zod in artifacts/api-server — it must be a direct dependency.
---

## Rule
The api-server must declare `zod` as a direct dependency in its `package.json`. Importing `zod/v4` without it causes a TS2307 typecheck failure even though `@workspace/api-zod` uses zod internally.

## Why
pnpm hoisting doesn't guarantee transitive deps are resolvable by TypeScript in strict workspace setups.

## How to apply
Run `pnpm --filter @workspace/api-server add zod` before adding any route that imports zod directly.
