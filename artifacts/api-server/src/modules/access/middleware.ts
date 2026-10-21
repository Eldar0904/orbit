import type { RequestHandler, Request } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import { db, workspaceMembershipsTable, projectsTable, projectMembershipsTable, tasksTable, membersTable } from "@workspace/db";
import { canAccessProject, parseId, type AccessScope, type AccessRole } from "./policy";

declare global { namespace Express { interface Request { access: AccessScope } } }

export async function resolveScope(subject: string, workspaceId?: number): Promise<AccessScope | null> {
  const memberships = await db.select().from(workspaceMembershipsTable).where(eq(workspaceMembershipsTable.clerkSubject, subject));
  const membership = workspaceId ? memberships.find(m => m.workspaceId === workspaceId) : memberships.length === 1 ? memberships[0] : undefined;
  if (!membership) return null;
  const projects = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.workspaceId, membership.workspaceId));
  const grants = await db.select().from(projectMembershipsTable).where(and(eq(projectMembershipsTable.clerkSubject, subject), inArray(projectMembershipsTable.projectId, projects.map(p => p.id))));
  const admin = membership.role === "admin";
  return {
    workspaceId: membership.workspaceId, subject, role: membership.role as AccessRole,
    canReviewImports: membership.canReviewImports,
    projectIds: admin ? projects.map(p => p.id) : grants.map(g => g.projectId),
    writableProjectIds: admin ? projects.map(p => p.id) : membership.role === "editor" ? grants.filter(g => g.role === "editor").map(g => g.projectId) : [],
  };
}

export function createAccessMiddleware(deps: {
  subject: (req: Request) => string | null;
  scope: typeof resolveScope;
  taskProject: (id: number) => Promise<number | null>;
  memberInWorkspace: (id: number, workspaceId: number) => Promise<boolean>;
}): RequestHandler {
  return async (req, res, next) => {
    const subject = deps.subject(req);
    if (!subject) { res.status(401).json({ error: "Authentication required" }); return; }
    const header = req.header("x-workspace-id");
    const workspaceId = header === undefined ? undefined : parseId(header);
    if (workspaceId === null) { res.status(400).json({ error: "Invalid workspace selection" }); return; }
    const scope = await deps.scope(subject, workspaceId);
    if (!scope) { res.status(403).json({ error: "Select a workspace with an explicitly provisioned membership" }); return; }
    req.access = scope;
    if (/^\/dk\/projects\/[^/]+\/imports(?:\/|$)/.test(req.path) && !scope.canReviewImports) {
      res.status(403).json({ error: "Explicit import-review grant required" }); return;
    }
    const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (write && scope.role === "viewer") { res.status(403).json({ error: "Read-only workspace membership" }); return; }
    if (write && /^\/members(?:\/|$)/.test(req.path) && scope.role !== "admin") { res.status(403).json({ error: "Workspace administrator required" }); return; }
    if (req.method === "DELETE" && /^\/projects\/\d+$/.test(req.path) && scope.role !== "admin") { res.status(403).json({ error: "Workspace administrator required" }); return; }
    const projectMatch = req.path.match(/\/projects\/([^/]+)/);
    let projectId: number | null = null;
    if (projectMatch) projectId = parseId(projectMatch[1]);
    const taskMatch = req.path.match(/^\/tasks\/([^/]+)/);
    if (taskMatch) {
      const taskId = parseId(taskMatch[1]);
      projectId = taskId ? await deps.taskProject(taskId) : null;
    }
    if (req.method === "POST" && req.path === "/tasks") projectId = parseId(req.body?.projectId);
    if ((projectMatch || taskMatch || (req.method === "POST" && req.path === "/tasks")) && (!projectId || !canAccessProject(scope, projectId, write))) {
      res.status(404).json({ error: "Record not found" }); return;
    }
    const memberMatch = req.path.match(/^\/members\/([^/]+)/);
    const referencedMembers: unknown[] = [...(Array.isArray(req.body?.managerIds) ? req.body.managerIds : [])];
    if (req.body?.assigneeId != null) referencedMembers.push(req.body.assigneeId);
    if (memberMatch) referencedMembers.push(memberMatch[1]);
    for (const raw of referencedMembers) {
      const id = parseId(raw);
      if (!id || !await deps.memberInWorkspace(id, scope.workspaceId)) { res.status(404).json({ error: "Member not found" }); return; }
    }
    next();
  };
}

export const workspaceAccess = createAccessMiddleware({
  subject: req => getAuth(req).userId,
  scope: resolveScope,
  taskProject: async id => (await db.select({ projectId: tasksTable.projectId }).from(tasksTable).where(eq(tasksTable.id, id)))[0]?.projectId ?? null,
  memberInWorkspace: async (id, workspaceId) => !!(await db.select({ id: membersTable.id }).from(membersTable).where(and(eq(membersTable.id, id), eq(membersTable.workspaceId, workspaceId))))[0],
});
