import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  addFill,
  diffSteps,
  transform,
  varyPattern,
  type DrumSteps,
  type DrumTrackKind,
  type FillStyle,
  type Patch,
  type Pattern,
  type StepsFor,
  type TrackKind,
  type TransformMode,
} from "../server/music/index.js";
import { proposeIdeas } from "../server/sessions/store.js";
import type { StepValue } from "../server/sessions/types.js";
import {
  applyPatchToRow,
  loadSessionPattern,
  resolveBarRange,
  scaleLengthFor,
  stepsFor,
} from "./lib/generator-session.js";
import { trackKindSchema } from "./lib/session-schemas.js";

type VariationKind = "vary" | "fill" | "simplify" | "darker" | "brighter";

const FILL_STYLES: readonly FillStyle[] = ["roll", "stutter", "drop"];

const TRACK_LABELS: Record<TrackKind, string> = {
  kick: "kick",
  snare: "snare",
  hat: "hats",
  bass: "bass",
  keys: "keys",
};

interface VariationContext {
  sessionId: string;
  track: TrackKind;
  barStart: number;
  barEnd: number;
  bars: number;
  count: number;
  kind: VariationKind;
  pattern: Pattern;
  scaleLength: number;
  baseSeed: number;
}

interface Variation {
  patch: Patch;
  label: string;
  rationale: string;
}

function intensityFor(attempt: number, count: number): number {
  if (count <= 1) return 0.4;
  const step = 0.55 / (count - 1);
  return Math.min(0.9, 0.2 + Math.min(attempt, count - 1) * step);
}

function intensityWord(intensity: number): string {
  if (intensity < 0.34) return "Nudge";
  if (intensity < 0.62) return "Push";
  return "Shake up";
}

function vary(
  context: VariationContext,
  attempt: number,
  barStart = context.barStart,
  barEnd = context.barEnd,
): Patch {
  const intensity = intensityFor(attempt, context.count);
  return varyPattern(
    context.track,
    stepsFor(context.pattern, context.track),
    {
      barStart,
      barEnd,
      intensity,
      seed: context.baseSeed + attempt * 7919,
      scaleLength: context.scaleLength,
    },
  );
}

function transformVariation(
  context: VariationContext,
  attempt: number,
  mode: TransformMode,
): Patch {
  const rowSteps = context.pattern[context.track]!;
  const row = rowSteps as unknown as StepsFor<TrackKind>;
  const base = transform(context.track, row, context, mode, {
    scaleLength: context.scaleLength,
  });
  const transformed = applyPatchToRow(
    context.track,
    rowSteps,
    base,
    context.bars,
  );
  const overlay = varyPattern(
    context.track,
    transformed as unknown as StepsFor<TrackKind>,
    {
      barStart: context.barStart,
      barEnd: context.barEnd,
      intensity: Math.min(0.6, 0.18 + attempt * 0.14),
      seed: context.baseSeed + attempt * 7919,
      scaleLength: context.scaleLength,
    },
  );
  return diffSteps(
    context.track,
    rowSteps,
    applyPatchToRow(context.track, transformed, overlay, context.bars),
  );
}

function labelFor(context: VariationContext, attempt: number): string {
  const { track, barStart, barEnd } = context;
  const name = TRACK_LABELS[track];
  const bars =
    barStart === barEnd
      ? `bar ${barStart + 1}`
      : `bars ${barStart + 1}–${barEnd + 1}`;

  switch (context.kind) {
    case "vary":
      return `${intensityWord(intensityFor(attempt, context.count))} the ${name} in ${bars}`;
    case "fill":
      return `Fill ${bars} on the ${name}`;
    case "simplify":
      return `Simplify the ${name} in ${bars}`;
    case "darker":
      return `Make the ${name} darker in ${bars}`;
    case "brighter":
      return `Brighten the ${name} in ${bars}`;
  }
}

function rationaleFor(context: VariationContext, attempt: number): string {
  const name = TRACK_LABELS[context.track];
  switch (context.kind) {
    case "vary":
      return intensityFor(attempt, context.count) < 0.34
        ? `A light touch on the ${name} keeps the loop familiar while opening it up.`
        : `Moving a few ${name} hits off the grid adds motion without losing the pocket.`;
    case "fill":
      return `A ${FILL_STYLES[attempt % FILL_STYLES.length]} on the last beat signals the loop turn without changing the groove.`;
    case "simplify":
      return `Trimming non-downbeat ${name} hits leaves space and locks the pocket.`;
    case "darker":
      return `Pulling the ${name} down a step makes the loop sit back without losing its shape.`;
    case "brighter":
      return `Lifting the ${name} adds air so the loop feels more awake.`;
  }
}

function buildVariation(
  context: VariationContext,
  attempt: number,
): Variation {
  const fillStyle = FILL_STYLES[attempt % FILL_STYLES.length]!;
  const drumTrack =
    context.track === "kick" ||
    context.track === "snare" ||
    context.track === "hat"
      ? (context.track as DrumTrackKind)
      : null;

  let patch: Patch;
  if (context.kind === "vary") {
    patch = vary(context, attempt);
  } else if (context.kind === "fill") {
    if (drumTrack) {
      patch = addFill(
        context.pattern[drumTrack] as unknown as DrumSteps,
        context.barEnd,
        fillStyle,
        { track: drumTrack },
      );
    } else {
      patch = vary(context, attempt, context.barEnd, context.barEnd);
    }
  } else {
    patch = transformVariation(context, attempt, context.kind);
  }

  // Empty rows (or a no-op transform) can produce nothing; fall back to a
  // straightforward vary so every attempt has something to propose.
  if (patch.length === 0) {
    patch = vary(context, attempt);
  }

  return {
    patch,
    label: labelFor(context, attempt),
    rationale: rationaleFor(context, attempt),
  };
}

function patchKey(patch: Patch): string {
  return JSON.stringify(patch);
}

export default defineAction({
  description:
    "Generate a few distinct variations of one track in a bar range and put them straight into the idea tray, with no LLM call. Bar indexes are zero-based and inclusive, just like vary-pattern. Kinds: vary (new rhythm/movement), fill (a fill at barEnd), simplify / darker / brighter (a directional edit with a fresh rhythmic overlay). author defaults to \"You\"; count defaults to 3 (max 6 so the tray never overflows).",
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
    kind: z
      .enum(["vary", "fill", "simplify", "darker", "brighter"])
      .default("vary")
      .describe("What kind of variation to propose."),
    author: z
      .string()
      .min(1)
      .max(40)
      .default("You")
      .describe('Who suggested the ideas; defaults to "You".'),
    count: z.coerce
      .number()
      .int()
      .min(1)
      .max(6)
      .default(3)
      .describe("How many distinct ideas to propose (1-6, default 3)."),
  }),
  run: async (args) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const range = resolveBarRange(args.barStart, args.barEnd, bars);

    const count = args.count ?? 3;
    const author = args.author?.trim() || "You";
    const kind: VariationKind = args.kind ?? "vary";
    const context: VariationContext = {
      sessionId: args.sessionId,
      track: args.track,
      barStart: range.barStart,
      barEnd: range.barEnd,
      bars,
      count,
      kind,
      pattern,
      scaleLength: scaleLengthFor(detail.session.scale),
      // A per-call salt means clicking the button again yields fresh takes
      // instead of replaying the same three cards.
      baseSeed: (Date.now() % 1_000_000) + 1,
    };

    const variants: Variation[] = [];
    const seen = new Set<string>();
    const maxAttempts = Math.max(count * 8, 12);

    for (let attempt = 0; attempt < maxAttempts && variants.length < count; attempt++) {
      const variation = buildVariation(context, attempt);
      if (variation.patch.length === 0) continue;
      const key = patchKey(variation.patch);
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push(variation);
    }

    if (variants.length === 0) {
      throw new Error("Could not build a variation for that row and range.");
    }

    const ideas = await proposeIdeas({
      sessionId: args.sessionId,
      ideas: variants.map((variation) => ({
        author,
        label: variation.label,
        rationale: variation.rationale,
        patch: variation.patch,
      })),
    });

    return { ideas };
  },
});
