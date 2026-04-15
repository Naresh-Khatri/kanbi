import { boardRouter } from "@/server/api/routers/board";
import { columnRouter } from "@/server/api/routers/column";
import { projectRouter } from "@/server/api/routers/project";
import { taskRouter } from "@/server/api/routers/task";
import {
	createCallerFactory,
	createTRPCRouter,
	publicProcedure,
} from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
	health: publicProcedure.query(() => ({ ok: true })),
	project: projectRouter,
	board: boardRouter,
	column: columnRouter,
	task: taskRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
