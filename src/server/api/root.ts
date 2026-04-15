import { attachmentRouter } from "@/server/api/routers/attachment";
import { boardRouter } from "@/server/api/routers/board";
import { checklistRouter } from "@/server/api/routers/checklist";
import { columnRouter } from "@/server/api/routers/column";
import { commentRouter } from "@/server/api/routers/comment";
import { labelRouter } from "@/server/api/routers/label";
import { projectRouter } from "@/server/api/routers/project";
import { realtimeRouter } from "@/server/api/routers/realtime";
import { shareRouter } from "@/server/api/routers/share";
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
	label: labelRouter,
	checklist: checklistRouter,
	attachment: attachmentRouter,
	comment: commentRouter,
	share: shareRouter,
	realtime: realtimeRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
