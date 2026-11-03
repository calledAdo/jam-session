import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { addFill, type DrumSteps } from "../server/music/index.js";
import {
  loadSessionPattern,
  resolveBarRange,
  stepsFor,
} from "./lib/generator-session.js";

const FILL_TRACK = {
  roll: "snare",
  stutter: "hat",
  drop: "kick",
} as const;

export default defineAction({
  description:
    'Build a drum fill at the end of one bar and return the patch without writing. The bar index is zero-based (bar 3 is the fourth bar). Styles: "roll" fills the snare, "stutter" fills the hats, "drop" pulls hits out of the kick. Apply the patch with set-steps or send it to propose-ideas.',
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    bar: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based bar index to fill (the fill lands on its last beat)."),
    style: z
      .enum(["roll", "stutter", "drop"])
      .describe("Fill character: roll (snare), stutter (hats), drop (kick)."),
  }),
  readOnly: true,
  run: async (args) => {
    const { pattern, bars } = await loadSessionPattern(args.sessionId);
    const range = resolveBarRange(args.bar, args.bar, bars);
    const track = FILL_TRACK[args.style] ?? "snare";

    const patch = addFill(
      stepsFor(pattern, track) as unknown as DrumSteps,
      range.barStart,
      args.style,
      { track },
    );

    return {
      sessionId: args.sessionId,
      bar: range.barStart,
      style: args.style,
      track,
      patch,
      changed: patch.length > 0,
    };
  },
});
