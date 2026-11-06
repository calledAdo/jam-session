import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  diffSteps,
  setEnergy,
  setBassEnergy,
  type DrumSteps,
  type Patch,
} from "../server/music/index.js";
import { setSteps } from "../server/sessions/store.js";
import { loadSessionPattern, stepsFor } from "./lib/generator-session.js";

export default defineAction({
  description:
    "Set kick/snare/hat/bass energy (0–1) across the entire row. dryRun:true validates and returns the proposed patch without writing; ALWAYS use it for control probes. Omit dryRun for a user knob change or explicit apply. Drums: quarters at 0, eighths at 1/3, sixteenths at 2/3. Bass: bar roots at 0, kick-following at 1/3, eighths at 2/3, sixteenths at 5/6. Keys unsupported: one chord per bar, no hit rhythm. Actual writes are undoable and attributed to frontend user or agent.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    dryRun: z
      .boolean()
      .optional()
      .describe(
        "True for read-only validation/probing: return sessionId, patch, dryRun:true, applied:false; no edits or repeated session snapshot. Omit or false to write.",
      ),
    track: z
      .enum(["kick", "snare", "hat", "bass"])
      .describe(
        "Row to rewrite: kick, snare, hat, or bass. Keys is unsupported.",
      ),
    level: z.coerce
      .number()
      .min(0)
      .max(1)
      .describe(
        "Energy 0–1. Bass: 0 bar roots, 0.5 kick-following roots, 1 in-key sixteenths. Drums: 0 quarter notes, 1 accented sixteenths.",
      ),
  }),
  planMode: {
    effect: (args) => (args.dryRun === true ? "read" : "write"),
  },
  run: async (args, ctx) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const before = stepsFor(pattern, args.track);
    const next =
      args.track === "bass"
        ? setBassEnergy(pattern.bass, args.level, bars, {
            kick: pattern.kick,
            keys: pattern.keys,
            root: detail.session.root,
            scale: detail.session.scale,
          })
        : setEnergy(before as DrumSteps, args.level, bars);
    const patch: Patch = diffSteps(args.track, before, next);

    if (args.dryRun) {
      return { sessionId: args.sessionId, dryRun: true, applied: false, patch };
    }

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
