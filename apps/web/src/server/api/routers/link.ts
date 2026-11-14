import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getLinkPreview } from "@/server/link-preview";

export const linkRouter = createTRPCRouter({
  preview: protectedProcedure
    .input(z.object({ url: z.string().url().max(2048) }))
    .query(({ input }) => getLinkPreview(input.url)),
});
