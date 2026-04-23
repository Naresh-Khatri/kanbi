import "server-only";

import { cache } from "react";

import { api } from "@/trpc/server";

export const resolveProject = cache(async (slug: string) =>
  api.project.bySlug({ slug }).catch(() => null),
);
