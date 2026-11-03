import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  diffSteps,
  setEnergy,
  type DrumSteps,
  type Patch,
} from "../server/music/index.js";
import { setSteps } from "../server/sessions/store.js";
import { loadSessionPattern, stepsFor } from "./lib/generator-session.js";

export default defineAction({
  description:
    "Set the density of a drum row with one 0-1 control and write it to the grid. Level 0 leaves only the quarter-note downbeats; 1/3 brings in 8th notes; 2/3 fills every 16th; 1 accents the beats. The write uses the same edit path as set-steps with author \"agent\", so undo-last can revert it. Returns the updated session plus the patch that was written.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    track: z
      .enum(["kick", "snare", "hat"])
      .describe("Drum row to rewrite: kick, snare, or hat."),
    level: z.coerce
      .number()
      .min(0)
      .max(1)
      .describe("Energy from 0 (only downbeats) to 1 (every 16th, accented beats)."),
  }),
  run: async (args, ctx) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const before = stepsFor(pattern, args.track) as unknown as DrumSteps;
    const next = setEnergy(before, args.level, bars);
    const patch: Patch = diffSteps(args.track, before, next);

    if (patch.length === 0) {
      return { ...detail, applied: false, patch };
    }

    const updated = await setSteps({
      sessionId: args.sessionId,
      track: args.track,
      fromStep: 0,
      steps: next.slice(0, bars * 16),
      author: ctx?.caller === "frontend" ? "user" : "agent",
    });

    return { ...updated, applied: true, patch };
  },
});
