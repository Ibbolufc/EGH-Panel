import { Router, type IRouter } from "express";
import healthRouter from "./health";
import setupRouter from "./setup";
import authRouter from "./auth";
import usersRouter from "./users";
import nestsRouter from "./nests";
import eggsRouter from "./eggs";
import nodesRouter from "./nodes";
import serversRouter from "./servers";
import filesRouter from "./files";
import backupsRouter from "./backups";
import schedulesRouter from "./schedules";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";
import downloadRouter from "./download";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(setupRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(nestsRouter);
router.use(eggsRouter);
router.use(nodesRouter);
router.use(serversRouter);
router.use(filesRouter);
router.use(backupsRouter);
router.use(schedulesRouter);
router.use(activityRouter);
router.use(dashboardRouter);
router.use(downloadRouter);
router.use(settingsRouter);

export default router;
