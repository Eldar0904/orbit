// Local synthetic fixture only. This module is never imported by src/app.ts.
import { readFile } from "node:fs/promises";
import express from "express";
import { db, memory, workspacesTable, workspaceMembershipsTable, equipmentRoomsTable } from "./database";
import { createAccessMiddleware, resolveScope } from "../src/modules/access/middleware";
import equipment from "../src/routes/equipment";

if (process.env.DK_FIXTURE_PREVIEW !== "1") throw new Error("Synthetic preview requires explicit DK_FIXTURE_PREVIEW=1");
await memory.exec(await readFile("tests/legacy.sql", "utf8"));
await memory.exec(await readFile("../../lib/db/migrations/0001_dk_foundation.sql", "utf8"));
await db.insert(workspacesTable).values({ name: "LOCAL SYNTHETIC FIXTURE" });
await db.insert(workspaceMembershipsTable).values({ workspaceId: 1, clerkSubject: "fixture", role: "admin", canReviewImports: true });
const app = express(); app.use(express.json());
app.use("/api", createAccessMiddleware({ subject: () => "fixture", scope: resolveScope, taskProject: async () => null, memberInWorkspace: async () => false }));
app.get("/api/dk/access", (req,res) => res.json(req.access));
app.use("/api", equipment);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err); res.status(500).json({ error: "Synthetic preview failed" }); });
const server = app.listen(8089, "127.0.0.1", async () => {
  const response = await fetch("http://127.0.0.1:8089/api/dk/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "DEMO · 10 ДК", reportingCurrency: "KZT" }) });
  const project = await response.json() as { id: number };
  const sites = await fetch(`http://127.0.0.1:8089/api/dk/projects/${project.id}/sites`).then(r => r.json()) as { id: number }[];
  await db.insert(equipmentRoomsTable).values(sites.map(s => ({ siteId: s.id, code: "demo-room", name: "Демонстрационное помещение", numberText: "108", areaM2: "28.50" })));
  await fetch(`http://127.0.0.1:8089/api/dk/projects/${project.id}/imports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceBookId: "synthetic-fixture-only", capturedAt: "2026-10-20T10:00:00Z", captureMode: "snapshot", rows: [{ sheetId: 1, row: 4, kind: "requirement", values: { name: "DEMO: тестовая позиция", quantity: "#REF!" } }] }) });
  console.log("SYNTHETIC FIXTURE READY http://127.0.0.1:8089 project", project.id);
});
process.on("SIGINT", () => { server.close(); void memory.close().then(() => process.exit()); });
