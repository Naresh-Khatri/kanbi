import {
	createCallerFactory,
	createTRPCRouter,
	publicProcedure,
} from "@/server/api/trpc";

/**
 * Primary router. Sub-routers are registered here phase by phase
 * (project, board, column, task, label, checklist, attachment, comment,
 * activity, share, realtime).
 */
export const appRouter = createTRPCRouter({
	health: publicProcedure.query(() => ({ ok: true })),
});

export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
