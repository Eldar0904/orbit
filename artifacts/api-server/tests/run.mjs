import { build } from "esbuild";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

await build({
  entryPoints: ["tests/foundation.test.ts"], outfile: ".test-build/foundation.test.mjs",
  platform: "node", format: "esm", target: "node24", bundle: true, packages: "external",
  alias: {
    "@workspace/db": path.resolve("tests/database.ts"),
    "@workspace/api-zod": path.resolve("../../lib/api-zod/src/index.ts"),
    "drizzle-zod": require.resolve("drizzle-zod", { paths: [path.resolve("../../lib/db")] }).replace(/index\.cjs$/, "index.mjs"),
  },
});
const result = spawnSync(process.execPath, ["--test", ".test-build/foundation.test.mjs"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: "" } });
process.exitCode = result.status ?? 1;
