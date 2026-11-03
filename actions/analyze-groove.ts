import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { analyzeGroove } from "../server/music/index.js";
import { loadSessionPattern } from "./lib/generator-session.js";

export default defineAction({
  description:
    "Read a session's groove and return compact numbers plus short producer hints: per-row density, downbeat ratio, empty rows, repetition score, and whether bass and keys share a register. Read-only; use the hints to pick what to fix before calling a generator.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    bars: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe("How many bars to analyse from the start (defaults to the session length)."),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (args) => {
    const { pattern, bars } = await loadSessionPattern(args.sessionId);
    const barCount = Math.min(
      args.bars && args.bars > 0 ? Math.trunc(args.bars) : bars,
      bars,
    );
    const analysis = analyzeGroove(pattern, barCount);

    return {
      sessionId: args.sessionId,
      bars: barCount,
      ...analysis,
    };
  },
});
