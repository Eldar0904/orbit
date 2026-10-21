import { build } from "esbuild";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
const require = createRequire(import.meta.url);
await build({ entryPoints: ["tests/preview-server.ts"], outfile: ".test-build/preview.mjs", bundle: true, packages: "external", format: "esm", platform: "node", target: "node24", alias: {
  "@workspace/db": path.resolve("tests/database.ts"),
  "@workspace/api-zod": path.resolve("../../lib/api-zod/src/index.ts"),
  "drizzle-zod": require.resolve("drizzle-zod", { paths: [path.resolve("../../lib/db")] }).replace(/index\.cjs$/, "index.mjs"),
} });
const child = spawn(process.execPath, [".test-build/preview.mjs"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: "", DK_FIXTURE_PREVIEW: "1" } });
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", code => { process.exitCode = code ?? 0; });
