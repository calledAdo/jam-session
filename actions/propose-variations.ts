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

function vary(
  context: VariationContext,
  attempt: number,
  barStart = context.barStart,
  barEnd = context.barEnd,
): Patch {
  const intensity = intensityFor(attempt, context.count);
  return varyPattern(context.track, stepsFor(context.pattern, context.track), {
    barStart,
    barEnd,
    intensity,
    seed: context.baseSeed + attempt * 7919,
    scaleLength: context.scaleLength,
  });
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

function buildTrackPatch(context: VariationContext, attempt: number): Patch {
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
    if (!drumTrack) return [];
    patch = addFill(
      context.pattern[drumTrack] as unknown as DrumSteps,
      context.barEnd,
      fillStyle,
      { track: drumTrack },
    );
  } else {
    patch = transformVariation(context, attempt, context.kind);
  }

  return patch;
}

function tracksForKind(tracks: TrackKind[], kind: VariationKind): TrackKind[] {
  if (kind === "fill") {
    return tracks.filter((track) => track !== "bass" && track !== "keys");
  }
  if (kind === "darker" || kind === "brighter") {
    return tracks.filter((track) => track === "bass" || track === "keys");
  }
  return tracks;
}

function labelForTracks(
  tracks: readonly TrackKind[],
  context: Omit<VariationContext, "track">,
): string {
  const labels = tracks.map((track) => TRACK_LABELS[track]);
  const bars =
    context.barStart === context.barEnd
      ? `bar ${context.barStart + 1}`
      : `bars ${context.barStart + 1}-${context.barEnd + 1}`;
  const kind =
    context.kind === "vary"
      ? "Vary"
      : context.kind === "fill"
        ? "Fill"
        : context.kind === "simplify"
          ? "Simplify"
          : context.kind === "darker"
            ? "Darker"
            : "Brighter";
  return `${kind} ${bars} (${labels.join(", ")})`;
}

function rationaleForTracks(
  tracks: readonly TrackKind[],
  kind: VariationKind,
  attempt: number,
  count: number,
): string {
  const names = tracks.map((track) => TRACK_LABELS[track]);
  const joined =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
      : names[0]!;
  switch (kind) {
    case "vary":
      return intensityFor(attempt, count) < 0.34
        ? `A light touch across ${joined} keeps the loop familiar while opening it up.`
        : `Small shifts across ${joined} add motion without losing the pocket.`;
    case "fill":
      return `A ${FILL_STYLES[attempt % FILL_STYLES.length]} across ${joined} signals the loop turn.`;
    case "simplify":
      return `Trimming non-downbeat hits across ${joined} leaves space and locks the pocket.`;
    case "darker":
      return `Pulling ${joined} down a step makes the loop sit back without losing its shape.`;
    case "brighter":
      return `Lifting ${joined} adds air so the loop feels more awake.`;
  }
}

function patchKey(patch: Patch): string {
  return JSON.stringify(patch);
}

export default defineAction({
  description:
    'Generate a few distinct variations across one or more selected tracks and put them straight into the idea tray, with no LLM call. Pass exactly one of track (backward compatible) or tracks. Bar indexes are zero-based and inclusive. Fill applies to drums; darker and brighter apply to bass and keys. author defaults to "You"; count defaults to 3 (max 6).',
  schema: z
    .object({
      sessionId: z.string().min(1).describe("Session id."),
      track: trackKindSchema.optional(),
      tracks: z.array(trackKindSchema).min(1).optional(),
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
    })
    .refine((args) => Boolean(args.track) !== Boolean(args.tracks), {
      message: "Pass exactly one of track or tracks.",
    }),
  run: async (args) => {
    const { detail, pattern, bars } = await loadSessionPattern(args.sessionId);
    const range = resolveBarRange(args.barStart, args.barEnd, bars);

    const count = args.count ?? 3;
    const author = args.author?.trim() || "You";
    const kind: VariationKind = args.kind ?? "vary";
    const tracks = tracksForKind(
      [...new Set(args.tracks ?? [args.track!])],
      kind,
    );
    if (tracks.length === 0) {
      throw new Error(`No selected tracks support ${kind} variations.`);
    }
    const baseContext = {
      sessionId: args.sessionId,
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

    for (
      let attempt = 0;
      attempt < maxAttempts && variants.length < count;
      attempt++
    ) {
      const perTrack = tracks
        .map((track) => ({
          track,
          patch: buildTrackPatch({ ...baseContext, track }, attempt),
        }))
        .filter(({ patch: trackPatch }) => trackPatch.length > 0);
      const patch = perTrack.flatMap(({ patch: trackPatch }) => trackPatch);
      if (patch.length === 0) continue;
      const key = patchKey(patch);
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push({
        patch,
        label: labelForTracks(
          perTrack.map(({ track }) => track),
          baseContext,
        ),
        rationale: rationaleForTracks(
          perTrack.map(({ track }) => track),
          kind,
          attempt,
          count,
        ),
      });
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
