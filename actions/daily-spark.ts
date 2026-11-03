import { defineAction } from "@agent-native/core/action";
import { notify } from "@agent-native/core/notifications";
import { z } from "zod";

import { varyPattern } from "../server/music/index.js";
import {
  pickSparkStyle,
  sparkBpm,
  sparkDateKey,
  sparkRowSeed,
  sparkSessionName,
  SPARK_BARS,
} from "../server/music/spark.js";
import {
  applyPatchToSession,
  createSession,
  getRecentTaste,
  listSessions,
} from "../server/sessions/store.js";
import {
  loadSessionPattern,
  scaleLengthFor,
  stepsFor,
} from "./lib/generator-session.js";

// Framework identity used when no request user exists (local dev, AUTH_DISABLED).
const FALLBACK_OWNER = "local@localhost";

export default defineAction({
  description:
    "Create today's daily spark: a 2-bar seed session named 'Spark — <date>' chosen from liked taste (lo-fi by default), with a small date-seeded vary pass on hats and bass. Sends an in-app notification linking to the session. Idempotent per day: a second call returns the existing spark.",
  schema: z.object({}),
  run: async (_args, ctx) => {
    const now = new Date();
    const dateKey = sparkDateKey(now);
    const name = sparkSessionName(dateKey);
    const owner = ctx?.userEmail ?? FALLBACK_OWNER;

    const existing = (await listSessions()).find((s) => s.name === name);
    let sessionId: string;
    let created: boolean;

    if (existing) {
      sessionId = existing.id;
      created = false;
    } else {
      const taste = await getRecentTaste(200);
      const style = pickSparkStyle(taste);
      const detail = await createSession({
        name,
        bars: SPARK_BARS,
        bpm: sparkBpm(style),
        seed: style,
      });
      sessionId = detail.session.id;
      created = true;

      const { pattern, bars } = await loadSessionPattern(sessionId);
      const scaleLength = scaleLengthFor(detail.session.scale);
      const range = { barStart: 0, barEnd: bars - 1 };
      const patch = [
        ...varyPattern("hat", stepsFor(pattern, "hat"), {
          ...range,
          intensity: 0.25,
          seed: sparkRowSeed(dateKey, "hat"),
          scaleLength,
        }),
        ...varyPattern("bass", stepsFor(pattern, "bass"), {
          ...range,
          intensity: 0.2,
          seed: sparkRowSeed(dateKey, "bass"),
          scaleLength,
        }),
      ];
      if (patch.length > 0) {
        await applyPatchToSession({
          sessionId,
          patch,
          author: "daily-spark",
        });
      }
    }

    const link = `/s/${sessionId}`;
    await notify(
      {
        severity: "info",
        title: "☀️ Fresh spark waiting",
        body: name,
        metadata: { link, sessionId, kind: "daily-spark" },
        idempotencyKey: `daily-spark:${dateKey}`,
      },
      { owner },
    );

    return { sessionId, name, link, created, dateKey };
  },
});
