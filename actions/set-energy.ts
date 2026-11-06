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
    "Set kick/snare/hat/bass energy (0–1) and write the row to the grid. Drums: quarter notes at 0, eighths at 1/3, sixteenths at 2/3. Bass: bar-downbeat chord roots at 0, kick-following roots at 1/3, eighths with in-key octave/fifth movement at 2/3, sixteenths at 5/6. Keys unsupported: one chord per bar, no hit rhythm. Same edit path and caller attribution as drums (frontend user, otherwise agent); undo-last reverts the write. Returns the session and written patch.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
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
