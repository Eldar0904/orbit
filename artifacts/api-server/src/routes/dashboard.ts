import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, projectsTable, tasksTable, activityTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [projects, tasks] = await Promise.all([
    db.select({ status: projectsTable.status }).from(projectsTable),
    db.select({ status: tasksTable.status, dueDate: tasksTable.dueDate }).from(tasksTable),
  ]);

  const now = new Date().toISOString().split("T")[0];
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "done"
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  res.json({
    totalProjects,
    activeProjects,
    totalTasks,
    completedTasks,
    overdueTasks,
    inProgressTasks,
    completionRate,
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 20;

  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(limit);

  res.json(
    activities.map((a) => ({
      id: String(a.id),
      type: a.type,
      title: a.title,
      entityType: a.entityType,
      entityId: a.entityId,
      projectName: a.projectName,
      assigneeName: a.assigneeName,
      createdAt: a.createdAt,
    }))
  );
});

export default router;
