import {
  TRACK_KINDS,
  totalSteps,
  type PatchEntry,
  type StepValue,
  type TrackKind,
} from "./types.js";

const DRUM_KINDS = new Set<TrackKind>(["kick", "snare", "hat"]);

function isTrackKind(value: unknown): value is TrackKind {
  return (
    typeof value === "string" && (TRACK_KINDS as readonly string[]).includes(value)
  );
}

function inputError(message: string): never {
  throw new Error(message);
}

/** Validates one cell value and returns the value we persist for that track. */
export function normalizeStepValue(
  kind: TrackKind,
  value: unknown,
  where: string,
): StepValue {
  if (DRUM_KINDS.has(kind)) {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 3
    ) {
      return inputError(
        `${where}: ${kind} steps must be integer velocities from 0 (off) to 3 (accent).`,
      );
    }
    return value;
  }

  if (kind === "bass") {
    if (value === null) return null;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < -24 ||
      value > 48
    ) {
      return inputError(
        `${where}: bass steps must be a scale-degree integer or null (rest).`,
      );
    }
    return value;
  }

  // keys: one roman-numeral chord per bar. Null is normalized to "no chord".
  if (value === null) return "";
  if (typeof value !== "string" || value.trim().length > 12) {
    return inputError(
      `${where}: keys steps must be short roman-numeral strings like "i" or "VI" (or null for no chord).`,
    );
  }
  return value.trim();
}

/**
 * Validates a patch against a session's bar count and returns a copy with
 * per-track values normalized (e.g. keys null -> "").
 */
export function normalizePatch(
  patch: unknown,
  bars: number,
): PatchEntry[] {
  if (!Array.isArray(patch) || patch.length === 0) {
    return inputError("Patch must contain at least one {track, fromStep, steps} entry.");
  }

  return patch.map((rawEntry, index) => {
    if (!rawEntry || typeof rawEntry !== "object") {
      return inputError(`Patch entry ${index + 1} must be an object.`);
    }

    const entry = rawEntry as Record<string, unknown>;
    if (!isTrackKind(entry.track)) {
      return inputError(
        `Patch entry ${index + 1} has unknown track "${String(
          entry.track,
        )}". Use one of: ${TRACK_KINDS.join(", ")}.`,
      );
    }

    const kind = entry.track;
    const fromStep = entry.fromStep;
    if (
      typeof fromStep !== "number" ||
      !Number.isInteger(fromStep) ||
      fromStep < 0
    ) {
      return inputError(
        `Patch entry ${index + 1} needs fromStep as a zero-based integer.`,
      );
    }

    if (!Array.isArray(entry.steps) || entry.steps.length === 0) {
      return inputError(
        `Patch entry ${index + 1} needs a non-empty steps array.`,
      );
    }

    const maxSteps = totalSteps(kind, bars);
    if (fromStep + entry.steps.length > maxSteps) {
      return inputError(
        `Patch entry ${index + 1} runs past the end of ${kind} (${maxSteps} steps for ${bars} bars).`,
      );
    }

    const steps = entry.steps.map((value, stepIndex) =>
      normalizeStepValue(
        kind,
        value,
        `Patch entry ${index + 1}, step ${fromStep + stepIndex}`,
      ),
    );

    return { track: kind, fromStep, steps };
  });
}

/** Throws when a patch cannot be applied to a session with this many bars. */
export function assertPatchInBounds(patch: unknown, bars: number): void {
  normalizePatch(patch, bars);
}

export function assertProgressionInput(
  bars: number[],
  numerals: string[],
  sessionBars: number,
): void {
  if (bars.length === 0) {
    return inputError("Provide at least one bar index.");
  }
  if (bars.length !== numerals.length) {
    return inputError("bars and numerals must have the same length.");
  }

  const seen = new Set<number>();
  for (const bar of bars) {
    if (!Number.isInteger(bar) || bar < 0 || bar >= sessionBars) {
      return inputError(
        `Bar ${bar} is out of range. Use zero-based bar indices from 0 to ${
          sessionBars - 1
        }.`,
      );
    }
    if (seen.has(bar)) {
      return inputError(`Bar ${bar} appears more than once.`);
    }
    seen.add(bar);
  }

  for (const numeral of numerals) {
    if (
      typeof numeral !== "string" ||
      numeral.trim().length === 0 ||
      numeral.trim().length > 12
    ) {
      return inputError(
        'Every numeral must be a short chord label such as "i", "VI", or "V7".',
      );
    }
  }
}
