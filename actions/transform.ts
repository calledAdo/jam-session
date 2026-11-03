import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  transform,
  TRACK_KINDS,
  type TrackKind,
} from "../server/music/index.js";
import {
  loadSessionPattern,
  resolveBarRange,
  scaleLengthFor,
  stepsFor,
} from "./lib/generator-session.js";
import { parseJsonArg } from "./lib/json-arg.js";
import { trackKindSchema } from "./lib/session-schemas.js";

const selectionSchema = z.preprocess(
  parseJsonArg,
  z.object({
    barStart: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based first bar of the selection (inclusive)."),
    barEnd: z.coerce
      .number()
      .int()
      .min(0)
      .describe("Zero-based last bar of the selection (inclusive)."),
    tracks: z
      .array(trackKindSchema)
      .min(1)
      .optional()
      .describe("Rows to transform; omit for all five."),
  }),
);

export default defineAction({
  description:
    'Apply a directional edit to the selected bars and return the patch without writing. Selection is {barStart, barEnd, tracks?} with zero-based, inclusive bars; tracks defaults to all five rows. Modes: "simplify" thins non-downbeat hits and holds chords, "darker" lowers velocities and pulls chords/bass down, "brighter" raises velocities and pushes chords/bass up. Apply the patch with set-steps or send it to propose-ideas.',
  schema: z.object({
    sessionId: z.string().min(1).describe("Session id."),
    selection: selectionSchema,
    mode: z
      .enum(["simplify", "darker", "brighter"])
      .describe("Direction of the edit."),
  }),
  readOnly: true,
  run: async (args) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const range = resolveBarRange(
      args.selection.barStart,
      args.selection.barEnd,
      bars,
    );
    const requested = args.selection.tracks;
    const tracks: TrackKind[] =
      requested && requested.length > 0 ? [...new Set(requested)] : [...TRACK_KINDS];

    const patch = tracks.flatMap((track) =>
      transform(track, stepsFor(pattern, track), range, args.mode, {
        scaleLength: scaleLengthFor(detail.session.scale),
      }),
    );

    return {
      sessionId: args.sessionId,
      mode: args.mode,
      selection: { ...range, tracks },
      patch,
      changed: patch.length > 0,
    };
  },
});
