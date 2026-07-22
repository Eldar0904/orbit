import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, projectsTable, membersTable, activityTable } from "@workspace/db";
import { syncProjectStatus } from "../lib/project-utils";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.projectId) {
    conditions.push(eq(tasksTable.projectId, params.data.projectId));
  }
  if (params.data.assigneeId) {
    conditions.push(eq(tasksTable.assigneeId, params.data.assigneeId));
  }
  if (params.data.status) {
    conditions.push(eq(tasksTable.status, params.data.status as "todo" | "in_progress" | "blocked" | "done"));
  }
  if (params.data.priority) {
    conditions.push(eq(tasksTable.priority, params.data.priority as "low" | "medium" | "high"));
  }

  const rows = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      assignee: {
        id: membersTable.id,
        name: membersTable.name,
        email: membersTable.email,
        avatarUrl: membersTable.avatarUrl,
        role: membersTable.role,
        createdAt: membersTable.createdAt,
      },
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      },
    })
    .from(tasksTable)
    .leftJoin(membersTable, eq(tasksTable.assigneeId, membersTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(tasksTable.createdAt);

  // Clean up null assignee/project from left join
  const tasks = rows.map((row) => ({
    ...row,
    assignee: row.assignee?.id ? row.assignee : null,
    project: row.project?.id ? row.project : null,
  }));

  res.json(tasks);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: (parsed.data.status as "todo" | "in_progress" | "blocked" | "done") ?? "todo",
      priority: (parsed.data.priority as "low" | "medium" | "high") ?? "medium",
      assigneeId: parsed.data.assigneeId ?? null,
      dueDate: parsed.data.dueDate ? String(parsed.data.dueDate) : null,
    })
    .returning();

  // Fetch project name for activity log
  let projectName: string | undefined;
  let assigneeName: string | undefined;

  const [project] = await db
    .select({ name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId));
  projectName = project?.name;

  if (task.assigneeId) {
    const [assignee] = await db
      .select({ name: membersTable.name })
      .from(membersTable)
      .where(eq(membersTable.id, task.assigneeId));
    assigneeName = assignee?.name;
  }

  await db.insert(activityTable).values({
    type: "task_created",
    title: `Task "${task.title}" created`,
    entityType: "task",
    entityId: task.id,
    projectName,
    assigneeName,
  });

  await syncProjectStatus(task.projectId);

  // Return task with joined data
  const [fullTask] = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      assignee: {
        id: membersTable.id,
        name: membersTable.name,
        email: membersTable.email,
        avatarUrl: membersTable.avatarUrl,
        role: membersTable.role,
        createdAt: membersTable.createdAt,
      },
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      },
    })
    .from(tasksTable)
    .leftJoin(membersTable, eq(tasksTable.assigneeId, membersTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(tasksTable.id, task.id));

  res.status(201).json({
    ...fullTask,
    assignee: fullTask?.assignee?.id ? fullTask.assignee : null,
    project: fullTask?.project?.id ? fullTask.project : null,
  });
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTaskParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      assignee: {
        id: membersTable.id,
        name: membersTable.name,
        email: membersTable.email,
        avatarUrl: membersTable.avatarUrl,
        role: membersTable.role,
        createdAt: membersTable.createdAt,
      },
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      },
    })
    .from(tasksTable)
    .leftJoin(membersTable, eq(tasksTable.assigneeId, membersTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(tasksTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    ...row,
    assignee: row.assignee?.id ? row.assignee : null,
    project: row.project?.id ? row.project : null,
  });
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTaskParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
  if ("assigneeId" in parsed.data) updateData.assigneeId = parsed.data.assigneeId;
  if ("dueDate" in parsed.data) updateData.dueDate = parsed.data.dueDate;

  const [task] = await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Log activity
  const activityType = parsed.data.status === "done" ? "task_completed" : "task_updated";
  let projectName: string | undefined;
  let assigneeName: string | undefined;
  const [project] = await db
    .select({ name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId));
  projectName = project?.name;
  if (task.assigneeId) {
    const [assignee] = await db
      .select({ name: membersTable.name })
      .from(membersTable)
      .where(eq(membersTable.id, task.assigneeId));
    assigneeName = assignee?.name;
  }
  await db.insert(activityTable).values({
    type: activityType,
    title: `Task "${task.title}" ${activityType === "task_completed" ? "completed" : "updated"}`,
    entityType: "task",
    entityId: task.id,
    projectName,
    assigneeName,
  });

  await syncProjectStatus(task.projectId);

  // Return with joined data
  const [fullTask] = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      assignee: {
        id: membersTable.id,
        name: membersTable.name,
        email: membersTable.email,
        avatarUrl: membersTable.avatarUrl,
        role: membersTable.role,
        createdAt: membersTable.createdAt,
      },
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      },
    })
    .from(tasksTable)
    .leftJoin(membersTable, eq(tasksTable.assigneeId, membersTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(tasksTable.id, task.id));

  res.json({
    ...fullTask,
    assignee: fullTask?.assignee?.id ? fullTask.assignee : null,
    project: fullTask?.project?.id ? fullTask.project : null,
  });
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTaskParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await syncProjectStatus(task.projectId);

  res.sendStatus(204);
});

export default router;
