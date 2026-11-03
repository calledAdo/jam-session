import { z } from "zod";

import {
  SESSION_SCALES,
  SESSION_SEEDS,
  TRACK_KINDS,
} from "../../server/sessions/types.js";
import { parseJsonArg } from "./json-arg.js";

export const trackKindSchema = z
  .enum(TRACK_KINDS)
  .describe("One of the five grid rows: kick, snare, hat, bass, or keys.");

export const stepValueSchema = z.union([
  z.number(),
  z.string(),
  z.null(),
]);

export const stepsSchema = z.preprocess(
  parseJsonArg,
  z
    .array(stepValueSchema)
    .min(1)
    .describe(
      "Contiguous cell values starting at fromStep. Drums use 0-3 velocities, bass uses scale-degree numbers or null, keys uses roman-numeral strings or null.",
    ),
);

export const patchEntrySchema = z.object({
  track: trackKindSchema,
  fromStep: z.coerce
    .number()
    .int()
    .min(0)
    .describe("Zero-based step index where this run starts."),
  steps: stepsSchema,
});

export const patchSchema = z.preprocess(
  parseJsonArg,
  z.array(patchEntrySchema).min(1),
);

export const ideaSchema = z.object({
  author: z
    .string()
    .min(1)
    .max(40)
    .describe('Who suggested it, e.g. "Drummer", "Bassist", "Keys", or "You".'),
  label: z
    .string()
    .min(1)
    .max(80)
    .describe('Short card label, e.g. "Drop the kick in bar 4".'),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One producer-language sentence explaining why it works."),
  patch: patchSchema.describe("Grid changes this idea would apply."),
});

export const bpmSchema = z.coerce
  .number()
  .int()
  .min(40)
  .max(240)
  .describe("Tempo in beats per minute (40-240).");

export const rootSchema = z
  .string()
  .regex(/^[A-G](#|b)?$/, 'Use a note name like "C", "F#", or "Bb".')
  .describe("Root note of the key.");

export const scaleSchema = z
  .enum(SESSION_SCALES)
  .describe("Scale used by the session.");

export const swingSchema = z.coerce
  .number()
  .min(0)
  .max(1)
  .describe("Swing amount from 0 (straight) to 1 (maximum).");

export const barsSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(16)
  .describe("Loop length in bars (1-16; the product default is 8).");

export const barIndicesSchema = z.preprocess(
  parseJsonArg,
  z
    .array(z.coerce.number().int().min(0))
    .min(1)
    .describe("Zero-based bar indices to write, e.g. [2,3] for bars 3-4."),
);

export const numeralsSchema = z.preprocess(
  parseJsonArg,
  z
    .array(z.string().min(1).max(12))
    .min(1)
    .describe('Roman-numeral chords parallel to bars[], e.g. ["i", "VI"].'),
);

export const authorSchema = z
  .string()
  .min(1)
  .max(40)
  .default("user")
  .describe(
    'Who applied the edit. Use "user" for direct UI edits and "agent" when the assistant writes to the grid itself.',
  );

export const seedSchema = z
  .enum(SESSION_SEEDS)
  .default("lofi")
  .describe("Starting style: lofi, house, or empty.");
