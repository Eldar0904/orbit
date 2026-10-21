import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import membersRouter from "./members";
import dashboardRouter from "./dashboard";
import { workspaceAccess } from "../modules/access/middleware";
import equipmentRouter from "./equipment";
import { getAuth } from "@clerk/express";
import { db, workspaceMembershipsTable, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.use(healthRouter);
router.get("/me/workspaces", async (req, res) => {
  const subject = getAuth(req).userId;
  if (!subject) { res.status(401).json({ error: "Authentication required" }); return; }
  const memberships = await db.select({ id: workspacesTable.id, name: workspacesTable.name, role: workspaceMembershipsTable.role }).from(workspaceMembershipsTable).innerJoin(workspacesTable, eq(workspaceMembershipsTable.workspaceId, workspacesTable.id)).where(eq(workspaceMembershipsTable.clerkSubject, subject));
  res.json(memberships);
});
router.use(workspaceAccess);
router.get("/dk/access", (req, res) => { res.json(req.access); });
router.use(equipmentRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(membersRouter);
router.use(dashboardRouter);

export default router;
