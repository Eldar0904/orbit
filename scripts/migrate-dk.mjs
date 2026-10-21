import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

if (process.env.DK_ISOLATED_DATABASE !== "confirmed" || !process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL for an isolated database and DK_ISOLATED_DATABASE=confirmed. Never run this against live data.");
}
const sql = await readFile(new URL("../lib/db/migrations/0001_dk_foundation.sql", import.meta.url), "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(74021001)");
  await client.query("CREATE TABLE IF NOT EXISTS orbit_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const result = await client.query("SELECT checksum FROM orbit_migrations WHERE name=$1", ["0001_dk_foundation"]);
  if (result.rows.length) {
    if (result.rows[0].checksum !== checksum) throw new Error("Migration checksum changed; write a new migration instead");
    console.log("DK foundation migration already applied");
  } else {
    await client.query(sql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, ""));
    await client.query("INSERT INTO orbit_migrations(name,checksum) VALUES ($1,$2)", ["0001_dk_foundation", checksum]);
    console.log("DK foundation migration applied to the explicitly selected isolated database");
  }
  await client.query("COMMIT");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }
