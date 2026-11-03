import {
  defineAutomation,
  listAutomationDefinitions,
} from "@agent-native/core/triggers";

// Same framework identity the daily-spark action falls back to.
const SEED_OWNER = "local@localhost";
const AUTOMATION_NAME = "daily-spark";

const PROMPT = [
  "Call the `daily-spark` action with no arguments.",
  "It creates today's spark session and sends the in-app notification itself.",
  "Reply with one line: the spark's name and its link.",
].join("\n");

/** Seeds the 9:00 daily-spark automation once, if it does not already exist. */
export default async (_nitroApp: unknown): Promise<void> => {
  try {
    const actor = { userEmail: SEED_OWNER };
    const existing = await listAutomationDefinitions(actor, "personal");
    if (existing.some((a: { name: string }) => a.name === AUTOMATION_NAME)) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await defineAutomation(actor, {
      name: AUTOMATION_NAME,
      scope: "personal",
      triggerType: "schedule",
      schedule: "0 9 * * *",
      timezone,
      enabled: true,
      body: PROMPT,
      domain: "jam-session",
    });
  } catch (error) {
    console.warn(
      "[daily-spark] automation seed skipped:",
      error instanceof Error ? error.message : error,
    );
  }
};
