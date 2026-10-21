import pg from "pg";

const [name, subject, grant] = process.argv.slice(2);
if (process.env.DK_ISOLATED_DATABASE !== "confirmed" || !process.env.DATABASE_URL || !name || !/^user_[A-Za-z0-9]+$/.test(subject ?? "") || (grant && grant !== "--import-review")) {
  throw new Error("Usage: DK_ISOLATED_DATABASE=confirmed DATABASE_URL=... node scripts/provision-dk-workspace.mjs NAME VERIFIED_CLERK_SUBJECT [--import-review]. Provision only an explicitly verified identity on an isolated database.");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query("SELECT id FROM workspaces WHERE name=$1", [name]);
  if (existing.rowCount) throw new Error("Workspace name already exists. Review existing memberships explicitly; do not create duplicates.");
  const result = await client.query("INSERT INTO workspaces(name) VALUES ($1) RETURNING id", [name]);
  await client.query("INSERT INTO workspace_memberships(workspace_id,clerk_subject,role,can_review_imports) VALUES ($1,$2,'admin',$3)", [result.rows[0].id, subject, grant === "--import-review"]);
  await client.query("COMMIT");
  console.log("Created isolated workspace", result.rows[0].id, "with explicit identity binding. No legacy records adopted.");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }
