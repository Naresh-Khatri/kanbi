import { getTableColumns } from "drizzle-orm";

import { task } from "@/server/db/schema";

const { sourceText: _sourceText, ...taskReadColumns } = getTableColumns(task);

/** Task columns safe for board payloads (public share uses its own allowlist). */
export { taskReadColumns };
