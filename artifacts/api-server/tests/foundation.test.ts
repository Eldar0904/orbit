import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mountFrontend } from "../src/lib/frontend";
import express from "express";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, memory, projectsTable, workspacesTable, workspaceMembershipsTable, projectMembershipsTable, membersTable, tasksTable, equipmentImportsTable } from "./database";
import { createAccessMiddleware, resolveScope } from "../src/modules/access/middleware";
import { decimalString, parseSourceDecimal } from "../src/modules/equipment/decimal";
import { inspectBatch, stagingSchema } from "../src/modules/equipment/staging";
import { trustedOrigin } from "../src/modules/access/origin";
import equipment from "../src/routes/equipment";
import projects from "../src/routes/projects";
import tasks from "../src/routes/tasks";
import members from "../src/routes/members";
import dashboard from "../src/routes/dashboard";

let server: Server, origin: string, projectId: number, siteId: number;
const source = { sourceBookId: "synthetic-source-only", capturedAt: "2026-10-20T10:00:00Z", captureMode: "sequential", rows: [
  { sheetId: 1, row: 4, kind: "room", values: { name: "Synthetic room", areaM2: "28,50" } },
  { sheetId: 2, row: 12, kind: "payment", values: { amount: "13 277,70$", currency: "USD" } },
  { sheetId: 2, row: 13, kind: "requirement", values: { quantity: "#REF!" } },
] };
async function request(path: string, method = "GET", body?: unknown, subject = "owner", workspace = "1") {
  const response = await fetch(origin + path, { method, headers: { "content-type": "application/json", "x-test-user": subject, "x-workspace-id": workspace }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
before(async () => {
  await memory.exec(await readFile("tests/legacy.sql", "utf8"));
  await memory.exec(await readFile("../../lib/db/migrations/0001_dk_foundation.sql", "utf8"));
  await db.insert(workspacesTable).values([{ name: "Workspace A" }, { name: "Workspace B" }]);
  await db.insert(workspaceMembershipsTable).values([
    { workspaceId: 1, clerkSubject: "owner", role: "admin", canReviewImports: true },
    { workspaceId: 2, clerkSubject: "other", role: "admin", canReviewImports: true },
    { workspaceId: 1, clerkSubject: "viewer", role: "viewer" },
    { workspaceId: 1, clerkSubject: "editor", role: "editor" },
  ]);
  const app = express(); app.use(express.json());
  app.use(createAccessMiddleware({ subject: req => req.header("x-test-user") || null, scope: resolveScope,
    taskProject: async id => (await db.select().from(tasksTable).where(eq(tasksTable.id, id)))[0]?.projectId ?? null,
    memberInWorkspace: async (id, workspaceId) => (await db.select().from(membersTable).where(eq(membersTable.id, id)))[0]?.workspaceId === workspaceId,
  }));
  app.use(equipment); app.use(projects); app.use(tasks); app.use(members); app.use(dashboard);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err); res.status(500).json({ error: "Test route failed" }); });
  server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await memory.close(); });

test("migration preserves legacy amounts and leaves them unassigned", async () => {
  const result = await request("/projects"); assert.equal(result.status, 200); assert.deepEqual(result.body, []);
  const [legacy] = await db.select().from(projectsTable).where(eq(projectsTable.id, 1));
  assert.equal(legacy.budget, 1411219426); assert.equal(legacy.workspaceId, null); assert.equal(legacy.reportingCurrency, null);
});
test("reject anonymous, unknown user and malformed workspace", async () => {
  assert.equal((await request("/projects", "GET", undefined, "")).status, 401);
  assert.equal((await request("/projects", "GET", undefined, "unprovisioned")).status, 403);
  assert.equal((await request("/projects", "GET", undefined, "owner", "1junk")).status, 400);
});
test("create one DK project with ten sites and no approved budget", async () => {
  const created = await request("/dk/projects", "POST", { name: "Synthetic DK pilot", reportingCurrency: "KZT" });
  assert.equal(created.status, 201); projectId = created.body.id; assert.equal(created.body.baselineApproved, false);
  const sites = await request(`/dk/projects/${projectId}/sites`); assert.equal(sites.body.length, 10); siteId = sites.body[0].id;
  const summary = await request(`/dk/projects/${projectId}/summary`); assert.equal(summary.body.approvedPurchaseBudget, null); assert.equal(summary.body.confirmedPayments, null);
});
test("cross-workspace project and source access is hidden", async () => {
  assert.equal((await request(`/projects/${projectId}`, "GET", undefined, "other", "2")).status, 404);
  assert.equal((await request(`/dk/projects/${projectId}/sites`, "GET", undefined, "other", "2")).status, 404);
  assert.deepEqual((await request("/projects", "GET", undefined, "other", "2")).body, []);
  assert.equal((await request(`/projects/${projectId}junk`)).status, 404);
});
test("project viewer cannot write and needs an explicit import grant", async () => {
  await db.insert(projectMembershipsTable).values({ projectId, clerkSubject: "viewer", role: "viewer" });
  assert.equal((await request(`/dk/projects/${projectId}/sites`, "GET", undefined, "viewer")).status, 200);
  assert.equal((await request(`/dk/projects/${projectId}/sites`, "POST", { code: "extra", name: "No" }, "viewer")).status, 403);
  assert.equal((await request(`/dk/projects/${projectId}/imports`, "GET", undefined, "viewer")).status, 403);
});
test("workspace editor cannot edit an unassigned project or administer team", async () => {
  assert.equal((await request(`/projects/${projectId}`, "GET", undefined, "editor")).status, 404);
  assert.equal((await request("/members", "POST", { name: "No", email: "no@example.test" }, "editor")).status, 403);
});
test("room area is exact, room number remains text and duplicates conflict", async () => {
  const payload = { code: "room-1", name: "Synthetic room", numberText: "109,11", areaM2: "28.50" };
  const response = await request(`/dk/projects/${projectId}/sites/${siteId}/rooms`, "POST", payload);
  assert.equal(response.status, 201); assert.equal(response.body.areaM2, "28.50"); assert.equal(response.body.numberText, "109,11");
  assert.equal((await request(`/dk/projects/${projectId}/sites/${siteId}/rooms`, "POST", payload)).status, 409);
  assert.equal((await request(`/dk/projects/${projectId}/sites/${siteId}/rooms`, "POST", { ...payload, code: "bad", areaM2: "28.555" })).status, 400);
});
test("site must belong to the selected project", async () => {
  const second = await request("/dk/projects", "POST", { name: "Other pilot", reportingCurrency: "USD" });
  assert.equal((await request(`/dk/projects/${second.body.id}/sites/${siteId}/rooms`)).status, 404);
});
test("staging preserves errors and foreign currency text without posting facts", async () => {
  const result = await request(`/dk/projects/${projectId}/imports`, "POST", source);
  assert.equal(result.status, 201); assert.equal(result.body.summary.approved, false); assert.equal(result.body.summary.sourceWriteAllowed, false);
  assert(result.body.summary.issues.some((i: { code: string }) => i.code === "PAYMENT_EVIDENCE_REQUIRED"));
  assert(result.body.summary.issues.some((i: { code: string }) => i.code === "SOURCE_ERROR"));
  const stored = await request(`/dk/projects/${projectId}/imports/${result.body.id}`);
  assert.equal(stored.body.payload.rows.find((r: {kind: string}) => r.kind === "payment").values.amount, "13 277,70$");
  const summary = await request(`/dk/projects/${projectId}/summary`); assert.equal(summary.body.confirmedPayments, null);
});
test("repeated capture with moved JSON keys, row order or timestamp is idempotent", async () => {
  const result = await request(`/dk/projects/${projectId}/imports`, "POST", { ...source, capturedAt: "2026-10-21T10:00:00Z", rows: [...source.rows].reverse() });
  assert.equal(result.status, 200); assert.equal(result.body.repeated, true);
  assert.equal((await db.select().from(equipmentImportsTable).where(eq(equipmentImportsTable.projectId, projectId))).length, 1);
});
test("import API rejects approval flags, duplicate locators and unsafe source IDs", async () => {
  assert.equal((await request(`/dk/projects/${projectId}/imports`, "POST", { ...source, approved: true })).status, 400);
  assert.equal((await request(`/dk/projects/${projectId}/imports`, "POST", { ...source, rows: [source.rows[0], source.rows[0]] })).status, 400);
  assert.equal((await request(`/dk/projects/${projectId}/imports`, "POST", { ...source, sourceBookId: "https://host/secret" })).status, 400);
});
test("foreign member references cannot be assigned to tasks or managers", async () => {
  const [member] = await db.insert(membersTable).values({ name: "Foreign", email: "foreign@example.test", workspaceId: 2 }).returning();
  assert.equal((await request("/tasks", "POST", { projectId, title: "No", assigneeId: member.id })).status, 404);
  assert.equal((await request(`/projects/${projectId}`, "PATCH", { managerIds: [member.id] })).status, 404);
});
test("completing every task cannot archive equipment project", async () => {
  const created = await request("/tasks", "POST", { projectId, title: "Synthetic task", status: "todo", priority: "medium" });
  assert.equal(created.status, 201);
  assert.equal((await request(`/tasks/${created.body.id}`, "PATCH", { status: "done" })).status, 200);
  assert.equal((await request(`/projects/${projectId}`)).body.status, "active");
  assert.equal((await request(`/projects/${projectId}`, "PATCH", { status: "archived" })).status, 422);
  assert.equal((await request(`/projects/${projectId}`, "PATCH", { budgetSpent: 123 })).status, 422);
});
test("dashboard aggregates and activity respect project access", async () => {
  const summary = await request("/dashboard/summary", "GET", undefined, "other", "2");
  assert.equal(summary.body.totalProjects, 0); assert.equal(summary.body.totalTasks, 0);
  assert.deepEqual((await request("/dashboard/activity", "GET", undefined, "other", "2")).body, []);
});
test("audit is append-only and invalid database roles are rejected", async () => {
  await assert.rejects(() => memory.exec("UPDATE audit_events SET actor='forged'"), /append-only/);
  await assert.rejects(() => memory.exec("UPDATE equipment_imports SET payload='{}'"), /immutable/);
  await assert.rejects(() => memory.exec("INSERT INTO workspace_memberships(workspace_id,clerk_subject,role) VALUES (1,'bad','god')"));
  await assert.rejects(() => memory.exec(`UPDATE projects SET approved_purchase_budget=12.34,reporting_currency=NULL WHERE id=${projectId}`));
});
test("decimal strings reject rounding, negatives and currency coercion", () => {
  assert.equal(decimalString("00012.3"), "12.30");
  assert.equal(decimalString("0"), "0.00");
  assert.throws(() => decimalString("12.345")); assert.throws(() => decimalString(-1));
  assert.equal(parseSourceDecimal("28\u00a0500,50").value, "28500.50");
  assert.equal(parseSourceDecimal(null).state, "blank"); assert.equal(parseSourceDecimal("#REF!").state, "error");
  assert.equal(parseSourceDecimal("0").value, "0.00"); assert.equal(parseSourceDecimal("13 277,70$").state, "invalid");
});
test("hash canonicalization is stable and content changes produce new candidates", () => {
  const parsed = stagingSchema.parse(source); const original = inspectBatch(parsed);
  const reordered = inspectBatch({ ...parsed, rows: parsed.rows.map(r => ({ ...r, values: Object.fromEntries(Object.entries(r.values).reverse()) })) });
  assert.equal(original.contentHash, reordered.contentHash);
  assert.notEqual(original.contentHash, inspectBatch({ ...parsed, rows: parsed.rows.slice(0, 1) }).contentHash);
});
test("browser origin policy rejects unlisted and opaque origins", () => {
  assert.equal(trustedOrigin("https://orbit.example", "orbit.example", undefined), true);
  assert.equal(trustedOrigin("https://attacker.example", "orbit.example", undefined), false);
  assert.equal(trustedOrigin("null", "orbit.example", undefined), false);
  assert.equal(trustedOrigin("http://localhost:5173", "localhost:8080", "http://localhost:5173"), true);
});

test("standalone hosting serves deep links without swallowing API or asset errors", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "orbit-hosting-"));
  let uiServer: Server | undefined;
  try {
    await writeFile(path.join(directory, "index.html"), "<html>Orbit hosting fixture</html>");
    const app = express();
    app.get("/api/healthz", (_req, res) => { res.json({ status: "ok" }); });
    mountFrontend(app, directory);
    uiServer = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const base = `http://127.0.0.1:${(uiServer.address() as { port: number }).port}`;
    const page = await fetch(base + "/projects/123", { headers: { accept: "text/html" } });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-store");
    assert.match(await page.text(), /Orbit hosting fixture/);
    assert.deepEqual(await (await fetch(base + "/api/healthz")).json(), { status: "ok" });
    const missingApi = await fetch(base + "/api/missing");
    assert.equal(missingApi.status, 404); assert.deepEqual(await missingApi.json(), { error: "Not found" });
    assert.equal((await fetch(base + "/assets/missing.js")).status, 404);
  } finally {
    if (uiServer) await new Promise<void>(resolve => uiServer!.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
