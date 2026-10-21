import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db, projectsTable, projectMembershipsTable, equipmentSitesTable, equipmentRoomsTable, equipmentImportsTable, auditEventsTable } from "@workspace/db";
import { decimalString } from "../modules/equipment/decimal";
import { stagingSchema, inspectBatch } from "../modules/equipment/staging";
import { parseId } from "../modules/access/policy";

const router: IRouter = Router();
for (const param of ["siteId", "batchId"]) router.param(param, (_req, res, next, value) => {
  if (!parseId(value)) { res.status(404).json({ error: "Record not found" }); return; }
  next();
});
const siteSchema = z.object({ code: z.string().regex(/^[a-z0-9-]{1,40}$/), name: z.string().trim().min(1).max(200), region: z.string().max(300).nullable().optional() }).strict();
const area = z.string().refine(value => { try { decimalString(value, 12, 2); return true; } catch { return false; } }, "Use a nonnegative decimal string with up to two decimal places");
const roomSchema = z.object({ code: z.string().regex(/^[a-z0-9-]{1,50}$/), name: z.string().trim().min(1).max(300), numberText: z.string().max(100).nullable().optional(), areaM2: area.nullable().optional() }).strict();

// Publicly known site names are template structure, not an approved specification.
const dkSites = [
  ["bakanas", "Баканас", "Алматинская"], ["shelek", "Шелек", "Алматинская"],
  ["betkainar", "Беткайнар", "Жамбылская"], ["asa", "Аса", "Жамбылская"],
  ["kainar", "Кайнар", "Абай"], ["makanshi", "Маканши", "Абай"],
  ["zhansugurov", "Жансугуров", "Жетысу"], ["kogaly", "Когалы", "Жетысу"],
  ["karagaily", "Карагайлы", "Карагандинская"], ["aktogai", "Актогай", "Карагандинская"],
];

router.post("/dk/projects", async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(200), reportingCurrency: z.enum(["KZT", "USD", "CNY"]) }).strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const project = await db.transaction(async tx => {
    const [p] = await tx.insert(projectsTable).values({ name: body.data.name, workspaceId: req.access.workspaceId, equipmentEnabled: true, reportingCurrency: body.data.reportingCurrency }).returning();
    await tx.insert(projectMembershipsTable).values({ projectId: p.id, clerkSubject: req.access.subject, role: "editor" });
    await tx.insert(equipmentSitesTable).values(dkSites.map(([code, name, region]) => ({ projectId: p.id, code, name, region })));
    await tx.insert(auditEventsTable).values({ workspaceId: req.access.workspaceId, projectId: p.id, actor: req.access.subject, action: "equipment_project_created", entityType: "project", entityId: String(p.id), details: { sites: 10, baselineApproved: false } });
    return p;
  });
  res.status(201).json({ id: project.id, name: project.name, sites: 10, baselineApproved: false });
});

router.use("/dk/projects/:id", async (req, res, next) => {
  const [project] = await db.select({ enabled: projectsTable.equipmentEnabled }).from(projectsTable).where(and(eq(projectsTable.id, Number(req.params.id)), eq(projectsTable.workspaceId, req.access.workspaceId)));
  if (!project?.enabled) { res.status(404).json({ error: "Equipment project not found" }); return; }
  next();
});

router.get("/dk/projects/:id/sites", async (req, res) => {
  const sites = await db.select().from(equipmentSitesTable).where(eq(equipmentSitesTable.projectId, Number(req.params.id))).orderBy(equipmentSitesTable.id);
  res.json(sites);
});
router.post("/dk/projects/:id/sites", async (req, res) => {
  const body = siteSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [site] = await db.transaction(async tx => {
    const result = await tx.insert(equipmentSitesTable).values({ ...body.data, projectId: Number(req.params.id) }).onConflictDoNothing().returning();
    if (result[0]) await tx.insert(auditEventsTable).values({ workspaceId: req.access.workspaceId, projectId: Number(req.params.id), actor: req.access.subject, action: "site_created", entityType: "site", entityId: String(result[0].id) });
    return result;
  });
  if (!site) { res.status(409).json({ error: "Site code already exists" }); return; }
  res.status(201).json(site);
});

router.get("/dk/projects/:id/sites/:siteId/rooms", async (req, res) => {
  const [site] = await db.select().from(equipmentSitesTable).where(and(eq(equipmentSitesTable.id, Number(req.params.siteId)), eq(equipmentSitesTable.projectId, Number(req.params.id))));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }
  res.json(await db.select().from(equipmentRoomsTable).where(eq(equipmentRoomsTable.siteId, site.id)).orderBy(equipmentRoomsTable.id));
});
router.post("/dk/projects/:id/sites/:siteId/rooms", async (req, res) => {
  const body = roomSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [site] = await db.select().from(equipmentSitesTable).where(and(eq(equipmentSitesTable.id, Number(req.params.siteId)), eq(equipmentSitesTable.projectId, Number(req.params.id))));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }
  const room = await db.transaction(async tx => {
    const [r] = await tx.insert(equipmentRoomsTable).values({ ...body.data, siteId: site.id, areaM2: body.data.areaM2 == null ? null : decimalString(body.data.areaM2, 12, 2) }).onConflictDoNothing().returning();
    if (r) await tx.insert(auditEventsTable).values({ workspaceId: req.access.workspaceId, projectId: site.projectId, actor: req.access.subject, action: "room_created", entityType: "room", entityId: String(r.id), details: { sourceStatus: "unverified" } });
    return r;
  });
  if (!room) { res.status(409).json({ error: "Room code already exists" }); return; }
  res.status(201).json(room);
});

router.get("/dk/projects/:id/imports", async (req, res) => {
  const rows = await db.select({ id: equipmentImportsTable.id, sourceBookId: equipmentImportsTable.sourceBookId, capturedAt: equipmentImportsTable.capturedAt, contentHash: equipmentImportsTable.contentHash, summary: equipmentImportsTable.summary, status: equipmentImportsTable.status, createdAt: equipmentImportsTable.createdAt }).from(equipmentImportsTable).where(eq(equipmentImportsTable.projectId, Number(req.params.id))).orderBy(desc(equipmentImportsTable.id)).limit(100);
  res.json(rows);
});
router.post("/dk/projects/:id/imports", async (req, res) => {
  const parsed = stagingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > 2_000_000) { res.status(413).json({ error: "Split source batches into files below 2 MB" }); return; }
  const { normalized, contentHash, summary } = inspectBatch(parsed.data);
  const projectId = Number(req.params.id);
  const result = await db.transaction(async tx => {
    const [created] = await tx.insert(equipmentImportsTable).values({ projectId, sourceBookId: normalized.sourceBookId, capturedAt: new Date(normalized.capturedAt), contentHash, payload: normalized, summary, createdBy: req.access.subject }).onConflictDoNothing().returning({ id: equipmentImportsTable.id });
    if (created) await tx.insert(auditEventsTable).values({ workspaceId: req.access.workspaceId, projectId, actor: req.access.subject, action: "source_staged", entityType: "import", entityId: String(created.id), details: { contentHash, rowCount: summary.rowCount, approved: false } });
    const existing = created ?? (await tx.select({ id: equipmentImportsTable.id }).from(equipmentImportsTable).where(and(eq(equipmentImportsTable.projectId, projectId), eq(equipmentImportsTable.contentHash, contentHash), eq(equipmentImportsTable.mappingVersion, "dk-discovery-v1"))))[0];
    return { ...existing, repeated: !created };
  });
  res.status(result.repeated ? 200 : 201).json({ ...result, contentHash, summary, status: "staged" });
});
router.get("/dk/projects/:id/imports/:batchId", async (req, res) => {
  const [batch] = await db.select().from(equipmentImportsTable).where(and(eq(equipmentImportsTable.id, Number(req.params.batchId)), eq(equipmentImportsTable.projectId, Number(req.params.id))));
  if (!batch) { res.status(404).json({ error: "Batch not found" }); return; }
  res.json(batch);
});
router.get("/dk/projects/:id/summary", async (req, res) => {
  const projectId = Number(req.params.id);
  const [project] = await db.select({ reportingCurrency: projectsTable.reportingCurrency, approvedPurchaseBudget: projectsTable.approvedPurchaseBudget }).from(projectsTable).where(eq(projectsTable.id, projectId));
  const [sites] = await db.select({ count: sql<number>`count(*)::int` }).from(equipmentSitesTable).where(eq(equipmentSitesTable.projectId, projectId));
  const [rooms] = await db.select({ count: sql<number>`count(*)::int` }).from(equipmentRoomsTable).innerJoin(equipmentSitesTable, eq(equipmentRoomsTable.siteId, equipmentSitesTable.id)).where(eq(equipmentSitesTable.projectId, projectId));
  res.json({ ...project, sites: sites.count, rooms: rooms.count, baselineApproved: false, confirmedPayments: null, deliveryProgress: null });
});

export default router;
