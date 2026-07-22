import { eq, and, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  tasksTable,
  membersTable,
  projectManagersTable,
  projectDocumentsTable,
} from "@workspace/db";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export function computeProgress(tasks: { status: string; dueDate: string | null }[], projectId: number) {
  const now = new Date().toISOString().split("T")[0];
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done").length;
  const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { projectId, total, todo, inProgress, blocked, done, completionPercent, overdue };
}

export async function syncProjectStatus(projectId: number): Promise<void> {
  const tasks = await db
    .select({ status: tasksTable.status })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId));

  if (tasks.length === 0) return;

  const allDone = tasks.every((t) => t.status === "done");
  const anyOpen = tasks.some((t) => t.status !== "done");

  const [project] = await db
    .select({ status: projectsTable.status })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) return;

  if (allDone && project.status === "active") {
    await db
      .update(projectsTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId));
  } else if (anyOpen && project.status === "archived") {
    await db
      .update(projectsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId));
  }
}

export async function getProjectManagers(projectId: number) {
  const rows = await db
    .select({
      id: membersTable.id,
      name: membersTable.name,
      email: membersTable.email,
      avatarUrl: membersTable.avatarUrl,
      role: membersTable.role,
      createdAt: membersTable.createdAt,
    })
    .from(projectManagersTable)
    .innerJoin(membersTable, eq(projectManagersTable.memberId, membersTable.id))
    .where(eq(projectManagersTable.projectId, projectId));

  return rows;
}

export async function setProjectManagers(projectId: number, managerIds: number[]): Promise<void> {
  await db.delete(projectManagersTable).where(eq(projectManagersTable.projectId, projectId));
  if (managerIds.length === 0) return;
  await db.insert(projectManagersTable).values(
    managerIds.map((memberId) => ({ projectId, memberId })),
  );
}

export async function buildRoleBreakdown(projectId: number) {
  const rows = await db
    .select({
      memberId: membersTable.id,
      memberName: membersTable.name,
      status: tasksTable.status,
    })
    .from(tasksTable)
    .innerJoin(membersTable, eq(tasksTable.assigneeId, membersTable.id))
    .where(eq(tasksTable.projectId, projectId));

  const map = new Map<number, { memberId: number; memberName: string; total: number; done: number }>();
  for (const row of rows) {
    const existing = map.get(row.memberId) ?? {
      memberId: row.memberId,
      memberName: row.memberName,
      total: 0,
      done: 0,
    };
    existing.total += 1;
    if (row.status === "done") existing.done += 1;
    map.set(row.memberId, existing);
  }

  return Array.from(map.values());
}

export function formatProject(row: typeof projectsTable.$inferSelect, managers: Awaited<ReturnType<typeof getProjectManagers>> = []) {
  return {
    ...row,
    budgetSpent: row.budgetSpent ?? 0,
    managerIds: managers.map((m) => m.id),
    managers,
  };
}

export async function getDocumentCount(projectId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectDocumentsTable)
    .where(eq(projectDocumentsTable.projectId, projectId));
  return result?.count ?? 0;
}

export function projectValuesFromInput(data: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  const fields = [
    "name", "description", "status", "color", "projectType", "kind", "stage",
    "location", "client", "budget", "budgetSpent", "area", "rooms", "floors", "note",
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) values[field] = data[field];
  }
  if (data.startDate !== undefined) values.startDate = data.startDate ? String(data.startDate) : null;
  if (data.endDate !== undefined) values.endDate = data.endDate ? String(data.endDate) : null;
  return values;
}
