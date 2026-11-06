export const TRACK_KINDS = ["kick", "snare", "hat", "bass", "keys"] as const;

export type TrackKind = (typeof TRACK_KINDS)[number];

/** A cell value: drum velocity (0-3), bass scale degree (or null), keys numeral (or null). */
export type StepValue = number | string | null;

/** The same patch shape the grid applies and idea cards carry. */
export type PatchEntry = {
  track: TrackKind;
  fromStep: number;
  steps: StepValue[];
};

export const SESSION_SCALES = [
  "major",
  "minor",
  "dorian",
  "pentatonic minor",
] as const;

export type SessionScale = (typeof SESSION_SCALES)[number];

export { SEED_STYLES as SESSION_SEEDS } from "../music/seed.js";
import type { SeedStyle } from "../music/seed.js";

export const SESSION_KITS = ["dusty", "boombap", "808", "clean"] as const;
export type SessionKit = (typeof SESSION_KITS)[number];

export type SessionSeed = SeedStyle;

export const IDEA_AUTHORS = [
  "Drummer",
  "Bassist",
  "Keys",
  "You",
  "agent",
] as const;

export const IDEA_STATUSES = ["pending", "kept", "tossed"] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** Bandmate voices that can answer a bar comment in the user's chat thread. */
export const REPLY_AUTHORS = [
  "Drummer",
  "Bassist",
  "Keys",
  "Bandmate",
] as const;

export type ReplyAuthor = (typeof REPLY_AUTHORS)[number];

export const COMMENT_STATUSES = ["open", "answered"] as const;

export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export function stepsPerBar(kind: TrackKind): number {
  return kind === "keys" ? 1 : 16;
}

export function totalSteps(kind: TrackKind, bars: number): number {
  return stepsPerBar(kind) * bars;
}
