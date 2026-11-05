import { getTableColumns } from "drizzle-orm";

import { task } from "@/server/db/schema";

const { sourceText: _sourceText, ...taskReadColumns } = getTableColumns(task);

/** Task columns safe for board and public-share payloads. */
export { taskReadColumns };
