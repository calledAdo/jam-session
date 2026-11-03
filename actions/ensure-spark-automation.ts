import { defineAction } from "@agent-native/core/action";
import {
  defineAutomation,
  listAutomationDefinitions,
} from "@agent-native/core/triggers";
import { z } from "zod";

const AUTOMATION_NAME = "daily-spark";

const PROMPT = [
  "Call the `daily-spark` action with no arguments.",
  "It creates today's spark session and sends the in-app notification itself.",
  "Reply with one line: the spark's name and its link.",
].join("\n");

export default defineAction({
  description:
    "Ensure the current user's 9:00 daily-spark automation exists.",
  schema: z.object({}),
  run: async (_args, ctx) => {
    const userEmail = ctx?.userEmail;
    if (!userEmail) {
      throw Object.assign(new Error("Authentication required to set up daily spark."), {
        statusCode: 401,
      });
    }

    const actor = { userEmail };
    const existing = await listAutomationDefinitions(actor, "personal");
    if (existing.some((automation) => automation.name === AUTOMATION_NAME)) {
      return { created: false, name: AUTOMATION_NAME };
    }

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

    return { created: true, name: AUTOMATION_NAME };
  },
});
