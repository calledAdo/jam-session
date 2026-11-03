import { fail } from "@agent-native/core";

/**
 * Direct grid writes from the agent bypass the idea tray, which breaks the
 * "propose, don't overwrite" contract. The agent must opt in explicitly,
 * which it should only do when the user asked it to apply a change.
 */
export function requireAgentConfirm(
  caller: string | undefined,
  confirmApply: boolean | undefined,
  suggestInstead: string,
): void {
  if (caller === "frontend" || confirmApply) return;
  fail(
    `This writes straight to the user's grid. To suggest a change, ${suggestInstead} and pass it to propose-ideas. Only set confirmApply: true when the user explicitly asked you to apply it.`,
    { statusCode: 400 },
  );
}
