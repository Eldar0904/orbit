---
name: OpenAPI codegen gotcha
description: Known issue with format:email in OpenAPI spec and Orval/zod/v4 codegen.
---

## Rule
Do NOT use `format: email` on any string field in `lib/api-spec/openapi.yaml`.

## Why
Orval generates `zod.email()` for `format: email`, which doesn't exist in zod/v4. This causes a runtime and typecheck failure in `@workspace/api-zod`.

## How to apply
Use `type: string` with no format for email fields. Validate email format in application logic if needed.
