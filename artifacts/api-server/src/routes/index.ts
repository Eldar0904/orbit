import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import membersRouter from "./members";
import dashboardRouter from "./dashboard";
import kazniisaRouter from "./kazniisa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(membersRouter);
router.use(dashboardRouter);
router.use(kazniisaRouter);

export default router;
