import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, projectCatalogsTable } from "@workspace/db";
import { z } from "zod/v4";
import { matchItems, type CatalogItemRow } from "../lib/matcher.js";

const router: IRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CatalogItemSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
});

const CatalogUploadBody = z.object({
  filename: z.string().min(1),
  items: z.array(CatalogItemSchema).min(1),
});

const MatchRequestBody = z.object({
  items: z.array(z.string().min(1)).min(1),
});

const ProjectIdParam = z.object({ id: z.coerce.number().int().positive() });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveProjectId(rawId: string): Promise<number | null> {
  const parsed = ProjectIdParam.safeParse({ id: rawId });
  if (!parsed.success) return null;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, parsed.data.id));
  return project?.id ?? null;
}

// ─── GET /projects/:id/catalog ────────────────────────────────────────────────

router.get("/projects/:id/catalog", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [catalog] = await db
    .select()
    .from(projectCatalogsTable)
    .where(eq(projectCatalogsTable.projectId, projectId));

  if (!catalog) {
    res.status(404).json({ error: "No catalog uploaded for this project" });
    return;
  }

  res.json(catalog);
});

// ─── POST /projects/:id/catalog ───────────────────────────────────────────────

router.post("/projects/:id/catalog", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = CatalogUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { filename, items } = parsed.data;

  // Upsert — replace if one already exists for this project
  const [catalog] = await db
    .insert(projectCatalogsTable)
    .values({
      projectId,
      filename,
      itemCount: items.length,
      items,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: projectCatalogsTable.projectId,
      set: {
        filename,
        itemCount: items.length,
        items,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(catalog);
});

// ─── DELETE /projects/:id/catalog ────────────────────────────────────────────

router.delete("/projects/:id/catalog", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [deleted] = await db
    .delete(projectCatalogsTable)
    .where(eq(projectCatalogsTable.projectId, projectId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "No catalog found for this project" });
    return;
  }

  res.sendStatus(204);
});

// ─── POST /projects/:id/match ─────────────────────────────────────────────────

router.post("/projects/:id/match", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = MatchRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [catalog] = await db
    .select()
    .from(projectCatalogsTable)
    .where(eq(projectCatalogsTable.projectId, projectId));

  if (!catalog) {
    res.status(404).json({ error: "No catalog uploaded for this project. Upload a catalog first." });
    return;
  }

  const catalogItems = catalog.items as CatalogItemRow[];
  const results = matchItems(parsed.data.items, catalogItems);

  res.json({ projectId, results });
});

export default router;
