import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  tasksTable,
  projectDocumentsTable,
} from "@workspace/db";
import {
  ListProjectsQueryParams,
  CreateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  GetProjectProgressParams,
  ListProjectDocumentsParams,
  CreateProjectDocumentParams,
  CreateProjectDocumentBody,
  DeleteProjectDocumentParams,
} from "@workspace/api-zod";
import {
  computeProgress,
  formatProject,
  getProjectManagers,
  setProjectManagers,
  buildRoleBreakdown,
  getDocumentCount,
  projectValuesFromInput,
} from "../lib/project-utils";

const router: IRouter = Router();

async function enrichProjectWithStats(project: ReturnType<typeof formatProject>) {
  const tasks = await db
    .select({ status: tasksTable.status, dueDate: tasksTable.dueDate })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, project.id));

  const progress = computeProgress(tasks, project.id);
  const documentCount = await getDocumentCount(project.id);
  const roleBreakdown = await buildRoleBreakdown(project.id);

  return { ...project, progress, documentCount, roleBreakdown };
}

router.get("/projects", async (req, res): Promise<void> => {
  const params = ListProjectsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.status) {
    conditions.push(eq(projectsTable.status, params.data.status as "active" | "archived"));
  }
  conditions.push(
    params.data.workspace === "b2g"
      ? sql`lower(coalesce(${projectsTable.projectType}, '')) = 'b2g'`
      : sql`lower(coalesce(${projectsTable.projectType}, '')) <> 'b2g'`,
  );

  const projects = await db
    .select()
    .from(projectsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(projectsTable.createdAt);

  const withStats = params.data.withStats === true;

  if (withStats) {
    const enriched = await Promise.all(
      projects.map(async (p) => {
        const managers = await getProjectManagers(p.id);
        return enrichProjectWithStats(formatProject(p, managers));
      }),
    );
    res.json(enriched);
    return;
  }

  const result = await Promise.all(
    projects.map(async (p) => {
      const managers = await getProjectManagers(p.id);
      return formatProject(p, managers);
    }),
  );
  res.json(result);
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { managerIds, ...rest } = parsed.data;
  const values = projectValuesFromInput(rest);

  const [project] = await db
    .insert(projectsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      status: (parsed.data.status as "active" | "archived") ?? "active",
      color: parsed.data.color ?? "#6366f1",
      stage: (parsed.data.stage as "p1" | "p2" | "p3" | "p4" | "p5" | "p6") ?? "p1",
      ...values,
    })
    .returning();

  if (managerIds?.length) {
    await setProjectManagers(project.id, managerIds);
  }

  const managers = await getProjectManagers(project.id);
  res.status(201).json(formatProject(project, managers));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const managers = await getProjectManagers(project.id);
  res.json(formatProject(project, managers));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { managerIds, ...rest } = parsed.data;
  const updateData = { ...projectValuesFromInput(rest), updatedAt: new Date() };

  const [project] = await db
    .update(projectsTable)
    .set(updateData)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (managerIds !== undefined) {
    await setProjectManagers(project.id, managerIds);
  }

  const managers = await getProjectManagers(project.id);
  res.json(formatProject(project, managers));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/projects/:id/progress", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProjectProgressParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = await db
    .select({ status: tasksTable.status, dueDate: tasksTable.dueDate })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, params.data.id));

  res.json(computeProgress(tasks, params.data.id));
});

router.get("/projects/:id/documents", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListProjectDocumentsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const documents = await db
    .select()
    .from(projectDocumentsTable)
    .where(eq(projectDocumentsTable.projectId, params.data.id))
    .orderBy(projectDocumentsTable.createdAt);

  res.json(documents);
});

router.post("/projects/:id/documents", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateProjectDocumentParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateProjectDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [document] = await db
    .insert(projectDocumentsTable)
    .values({
      projectId: params.data.id,
      name: parsed.data.name,
      category: (parsed.data.category ?? "other") as typeof projectDocumentsTable.$inferInsert.category,
      storageKey: parsed.data.storageKey ?? null,
      mimeType: parsed.data.mimeType ?? null,
      sizeBytes: parsed.data.sizeBytes ?? null,
    })
    .returning();

  res.status(201).json(document);
});

router.delete("/projects/:id/documents/:docId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawDocId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
  const params = DeleteProjectDocumentParams.safeParse({
    id: parseInt(rawId, 10),
    docId: parseInt(rawDocId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [document] = await db
    .delete(projectDocumentsTable)
    .where(
      and(
        eq(projectDocumentsTable.id, params.data.docId),
        eq(projectDocumentsTable.projectId, params.data.id),
      ),
    )
    .returning();

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
