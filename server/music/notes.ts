/**
 * Note, scale, and roman-numeral helpers.
 *
 * Pitch classes are spelled with sharps when generated. Roots may be written
 * as `"C"`, `"F#"`, `"Bb"`, and optionally include an octave (`"C3"`).
 */

const LETTER_PITCH_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  "pentatonic minor": [0, 3, 5, 7, 10],
} as const satisfies Record<string, readonly number[]>;

export type ScaleName = keyof typeof SCALE_INTERVALS;

const SCALE_ALIASES: Record<string, ScaleName> = {
  major: "major",
  ionian: "major",
  minor: "minor",
  "natural minor": "minor",
  aeolian: "minor",
  dorian: "dorian",
  "pentatonic minor": "pentatonic minor",
  "minor pentatonic": "pentatonic minor",
  "pentatonic-minor": "pentatonic minor",
};

export function normalizeScale(scale: string): ScaleName {
  const key = scale.trim().toLowerCase();
  const normalized = SCALE_ALIASES[key];
  if (!normalized) {
    throw new Error(`Unknown scale: ${scale}`);
  }
  return normalized;
}

/** How many degrees a scale has (5 for pentatonic, 7 otherwise). */
export function scaleLength(scale: ScaleName | string): number {
  return SCALE_INTERVALS[normalizeScale(scale)].length;
}

interface ParsedPitch {
  pitchClass: number;
  octave?: number;
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function parsePitch(value: string): ParsedPitch {
  const match = /^([A-Ga-g])([#b]{0,2})(-?\d+)?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid note: ${value}`);
  const letter = (match[1] ?? "").toUpperCase();
  const accidental = match[2] ?? "";
  const octaveText = match[3];

  let pitchClass = LETTER_PITCH_CLASS[letter];
  if (pitchClass === undefined) throw new Error(`Invalid note: ${value}`);
  for (const character of accidental) {
    pitchClass += character === "#" ? 1 : -1;
  }

  const parsed: ParsedPitch = { pitchClass: mod(pitchClass, 12) };
  if (octaveText !== undefined) parsed.octave = Number(octaveText);
  return parsed;
}

/** Convert a MIDI number to a sharp-spelled scientific pitch name. */
export function midiToNote(midi: number): string {
  const rounded = Math.round(midi);
  const name = SHARP_NOTE_NAMES[mod(rounded, 12)] ?? "C";
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

/** Convert a note name (octave defaults to 4) to a MIDI number. */
export function noteToMidi(note: string): number {
  const parsed = parsePitch(note);
  const octave = parsed.octave ?? 4;
  return (octave + 1) * 12 + parsed.pitchClass;
}

/**
 * One octave of a scale, starting on `root`, as scientific pitch names.
 * `scaleNotes("C", "major", 4)` → `["C4", "D4", ..., "B4"]`.
 */
export function scaleNotes(
  root: string,
  scale: ScaleName | string,
  octave: number,
): string[] {
  const intervals = SCALE_INTERVALS[normalizeScale(scale)];
  const { pitchClass } = parsePitch(root);
  const safeOctave = Number.isFinite(octave) ? Math.trunc(octave) : 4;
  return intervals.map((interval) =>
    midiToNote((safeOctave + 1) * 12 + pitchClass + interval),
  );
}

/**
 * Turn a 1-based scale degree into a note. Degrees above the scale length
 * wrap up an octave; degrees <= 0 wrap down. Defaults to octave 3 (or the
 * octave written in `root`).
 */
export function degreeToNote(
  root: string,
  scale: ScaleName | string,
  degree: number,
  octave?: number,
): string {
  if (!Number.isFinite(degree) || !Number.isInteger(degree)) {
    throw new Error(`Degree must be an integer: ${degree}`);
  }
  const normalizedScale = normalizeScale(scale);
  const intervals = SCALE_INTERVALS[normalizedScale];
  const parsedRoot = parsePitch(root);
  const baseOctave = octave ?? parsedRoot.octave ?? 3;
  const zeroBased = degree - 1;
  const interval = intervals[mod(zeroBased, intervals.length)] ?? 0;
  const octaveShift = Math.floor(zeroBased / intervals.length);
  return midiToNote(
    (baseOctave + octaveShift + 1) * 12 + parsedRoot.pitchClass + interval,
  );
}

export interface RomanNumeral {
  /** -1 = flat, 0 = natural, +1 = sharp. */
  accidental: number;
  /** 1..7 */
  degree: number;
  /** Original roman letters, preserving case. */
  roman: string;
  isUpper: boolean;
  diminished: boolean;
  augmented: boolean;
  /** Everything after the numeral/quality marker, e.g. `"7"`, `"sus4"`. */
  suffix: string;
}

/**
 * Parse numerals such as `i`, `ii°`, `III`, `bVII`, `V7`, `ivsus4`.
 * Returns null for anything that is not a roman numeral.
 */
export function parseRomanNumeral(numeral: string): RomanNumeral | null {
  const match = /^([b#]?)([ivIV]+)(°|o|ø|\+)?(.*)$/.exec(numeral.trim());
  if (!match) return null;
  const accidentalText = match[1] ?? "";
  const roman = match[2] ?? "";
  const quality = match[3] ?? "";
  const suffix = match[4] ?? "";

  const romanValues: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
  };
  const degree = romanValues[roman.toLowerCase()];
  if (degree === undefined) return null;

  return {
    accidental: accidentalText === "#" ? 1 : accidentalText === "b" ? -1 : 0,
    degree,
    roman,
    isUpper: roman === roman.toUpperCase(),
    diminished: quality === "°" || quality === "o" || quality === "ø",
    augmented: quality === "+",
    suffix,
  };
}

/** The bare scale degree of a numeral (`"bVII"` → 7), or null. */
export function romanToDegree(numeral: string): number | null {
  return parseRomanNumeral(numeral)?.degree ?? null;
}

function spellRoman(degree: number, upper: boolean): string {
  const names = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
  const name = names[mod(degree - 1, 7)] ?? "i";
  return upper ? name.toUpperCase() : name;
}

function formatRoman(parsed: RomanNumeral): string {
  const accidental =
    parsed.accidental === 1 ? "#" : parsed.accidental === -1 ? "b" : "";
  const quality = parsed.diminished ? "°" : parsed.augmented ? "+" : "";
  return `${accidental}${parsed.roman}${quality}${parsed.suffix}`;
}

/**
 * Build a diatonic triad (or seventh chord for `V7`-style numerals) and return
 * note names with octaves. Explicit `°` / `+` markers adjust the fifth only
 * when the diatonic stack does not already produce that quality, so `vii°` in
 * C major stays `B4 D5 F5` instead of being double-flattened.
 *
 * Pentatonic minor numerals use natural-minor harmony, which is the scale the
 * pentatonic is drawn from.
 */
export function romanToChord(
  root: string,
  scale: ScaleName | string,
  numeral: string,
  octave?: number,
): string[] {
  const parsed = parseRomanNumeral(numeral);
  if (!parsed) throw new Error(`Invalid roman numeral: ${numeral}`);

  const normalizedScale = normalizeScale(scale);
  const harmonyScale =
    normalizedScale === "pentatonic minor" ? "minor" : normalizedScale;
  const intervals = SCALE_INTERVALS[harmonyScale];
  const parsedRoot = parsePitch(root);
  const baseOctave = octave ?? parsedRoot.octave ?? 3;

  const stackedSteps = parsed.suffix.includes("7") ? [0, 2, 4, 6] : [0, 2, 4];
  const midiNotes = stackedSteps.map((step) => {
    const zeroBased = parsed.degree - 1 + step;
    const interval = intervals[mod(zeroBased, intervals.length)] ?? 0;
    const octaveShift = Math.floor(zeroBased / intervals.length);
    return (
      (baseOctave + octaveShift + 1) * 12 + parsedRoot.pitchClass + interval
    );
  });

  const rootNote = midiNotes[0];
  if (rootNote === undefined) return [];
  midiNotes[0] = rootNote + parsed.accidental;

  const fifth = midiNotes[2];
  if (fifth !== undefined) {
    const fifthInterval = mod(fifth - midiNotes[0], 12);
    if (parsed.diminished && fifthInterval === 7) midiNotes[2] = fifth - 1;
    if (parsed.augmented && fifthInterval === 7) midiNotes[2] = fifth + 1;
  }

  return midiNotes.map(midiToNote);
}

/**
 * Move a roman numeral diatonically by `delta` degrees (e.g. -2 is down a
 * third) and optionally force major/minor case. Quality markers and
 * extensions are preserved.
 */
export function shiftRomanNumeral(
  numeral: string,
  delta: number,
  caseMode?: "upper" | "lower",
): string {
  const parsed = parseRomanNumeral(numeral);
  if (!parsed) return numeral;
  const degree = mod(parsed.degree - 1 + delta, 7) + 1;
  const upper =
    caseMode === "upper" ? true : caseMode === "lower" ? false : parsed.isUpper;
  return formatRoman({ ...parsed, degree, roman: spellRoman(degree, upper) });
}

/** Strip extensions (`7`, `sus4`, `add9`, ...) while keeping the triad. */
export function simplifyRomanNumeral(numeral: string): string {
  const parsed = parseRomanNumeral(numeral);
  if (!parsed) return numeral;
  return formatRoman({ ...parsed, suffix: "" });
}
