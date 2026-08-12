import type { api } from "@/trpc/react";

type TrpcUtils = ReturnType<typeof api.useUtils>;

/** Refresh every cross-project surface affected by archive/restore transitions. */
export async function invalidateProjectLifecycle(utils: TrpcUtils) {
  await Promise.all([
    utils.project.list.invalidate(),
    utils.project.listArchived.invalidate(),
    utils.project.bySlug.invalidate(),
    utils.board.get.invalidate(),
    utils.today.list.invalidate(),
    utils.user.myWork.invalidate(),
    utils.task.search.invalidate(),
  ]);
}
