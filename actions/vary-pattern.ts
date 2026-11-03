import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { varyPattern } from "../server/music/index.js";
import {
  loadSessionPattern,
  resolveBarRange,
  scaleLengthFor,
  stepsFor,
} from "./lib/generator-session.js";
import { trackKindSchema } from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Mutate one track and return the resulting patch without writing to the grid. Bar indexes are zero-based and inclusive: barStart 0, barEnd 1 means the first two bars. Intensity runs 0-1 (0.2 is a nudge, 0.7 is bold). The same track, bars, intensity, and seed always produce the same patch. Apply the patch with set-steps or send it to propose-ideas.",
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    track: trackKindSchema,
    barStart: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based first bar of the range (inclusive)."),
    barEnd: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based last bar of the range (inclusive)."),
    intensity: z.coerce
      .number()
      .min(0)
      .max(1)
      .describe("How hard to vary the row, from 0 (nothing) to 1 (heavy)."),
    seed: z.coerce
      .number()
      .int()
      .optional()
      .describe("Optional integer seed; same seed + inputs = same patch."),
  }),
  readOnly: true,
  run: async (args) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const range = resolveBarRange(args.barStart, args.barEnd, bars);
    const intensity = Number.isFinite(args.intensity) ? args.intensity : 0.4;

    const patch = varyPattern(
      args.track,
      stepsFor(pattern, args.track),
      {
        ...range,
        intensity,
        ...(args.seed === undefined ? {} : { seed: args.seed }),
        scaleLength: scaleLengthFor(detail.session.scale),
      },
    );

    return {
      sessionId: args.sessionId,
      track: args.track,
      barStart: range.barStart,
      barEnd: range.barEnd,
      intensity,
      seed: args.seed ?? null,
      patch,
      changed: patch.length > 0,
    };
  },
});
