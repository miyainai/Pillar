import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pillarRouter from "./pillar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pillarRouter);

export default router;
