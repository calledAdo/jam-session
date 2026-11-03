import { ensureAdditiveColumns, getDbExec } from "@agent-native/core/db";

import { runSessionMigrations } from "../db/migrations.js";
import * as schema from "../db/schema.js";

export { runSessionMigrations };

function isDrizzleTable(value: unknown): value is object {
  return (
    !!value &&
    typeof value === "object" &&
    Object.getOwnPropertySymbols(value).some((symbol) =>
      symbol.toString().includes("drizzle"),
    )
  );
}

const schemaTables = Object.values(schema).filter(isDrizzleTable);

export default async (nitroApp: any): Promise<void> => {
  await runSessionMigrations(nitroApp);
  try {
    const summary = await ensureAdditiveColumns({
      db: getDbExec(),
      tables: schemaTables,
    });
    if (summary.errors.length > 0) {
      console.warn(
        "[db] ensureAdditiveColumns completed with errors:",
        summary.errors,
      );
    }
  } catch (error) {
    console.warn(
      "[db] ensureAdditiveColumns failed (non-fatal):",
      error instanceof Error ? error.message : error,
    );
  }
};
