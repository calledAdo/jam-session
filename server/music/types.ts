/**
 * Shared types for the pure music library.
 *
 * Nothing in `server/music` may import framework code, React, or a database.
 * Everything is deterministic: the same inputs always produce the same output.
 */

export const TRACK_KINDS = ["kick", "snare", "hat", "bass", "keys"] as const;

export type TrackKind = (typeof TRACK_KINDS)[number];

export type DrumTrackKind = "kick" | "snare" | "hat";

/** Steps per bar used by the grid. */
export const STEPS_PER_BAR = 16;

/**
 * Drum rows store one velocity per 16th note.
 * 0 = off, 1 = ghost, 2 = normal, 3 = accent.
 */
export type DrumSteps = number[];

/** Bass is monophonic: one scale degree (1-based) per 16th note, or null. */
export type BassSteps = (number | null)[];

/** Keys store one roman numeral per bar. An empty string means "no chord". */
export type KeysSteps = string[];

/** The concrete step-array type for a track kind. */
export type StepsFor<K extends TrackKind> = K extends DrumTrackKind
  ? DrumSteps
  : K extends "bass"
    ? BassSteps
    : KeysSteps;

/** A complete set of rows for a session. */
export interface Pattern {
  kick: DrumSteps;
  snare: DrumSteps;
  hat: DrumSteps;
  bass: BassSteps;
  keys: KeysSteps;
}

/** A value that can appear inside a patch. */
export type PatchStep = number | string | null;

/**
 * A patch is a list of row slices. `fromStep` is a 0-based index into the
 * row's step array (for keys the unit is a bar, since keys are one chord per
 * bar).
 */
export interface PatchEntry {
  track: TrackKind;
  fromStep: number;
  steps: PatchStep[];
}

export type Patch = PatchEntry[];

/**
 * Bar selection. Bar indexes are **0-based and inclusive** in this library:
 * `{barStart: 0, barEnd: 1}` is the first two bars. The UI is responsible for
 * showing musicians 1-based labels.
 */
export interface BarSelection {
  barStart: number;
  barEnd: number;
}

export interface VaryOptions extends BarSelection {
  /** 0 = barely touch it, 1 = heavy variation. Values outside 0..1 clamp. */
  intensity: number;
  /** Same seed + same input ⇒ same patch. Defaults to 1. */
  seed?: number;
  /**
   * Number of scale degrees available for bass moves (5 for pentatonic,
   * 7 otherwise). Defaults to 7.
   */
  scaleLength?: number;
}

export type FillStyle = "roll" | "stutter" | "drop";

export interface FillOptions {
  /** Defaults to snare for `roll`, hat for `stutter`, kick for `drop`. */
  track?: DrumTrackKind;
}

export type TransformMode = "simplify" | "darker" | "brighter";

export interface TransformOptions {
  /** Scale degrees for bass transforms. Defaults to 7. */
  scaleLength?: number;
}
