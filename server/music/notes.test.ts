import { describe, expect, it } from "vitest";

import {
  degreeToNote,
  midiToNote,
  noteToMidi,
  parseRomanNumeral,
  romanToChord,
  romanToDegree,
  scaleLength,
  scaleNotes,
  shiftRomanNumeral,
  simplifyRomanNumeral,
} from "./notes";

describe("scaleNotes", () => {
  it("spells C major from C4", () => {
    expect(scaleNotes("C", "major", 4)).toEqual([
      "C4",
      "D4",
      "E4",
      "F4",
      "G4",
      "A4",
      "B4",
    ]);
  });

  it("spells A natural minor from A3", () => {
    expect(scaleNotes("A", "minor", 3)).toEqual([
      "A3",
      "B3",
      "C4",
      "D4",
      "E4",
      "F4",
      "G4",
    ]);
  });

  it("spells D dorian", () => {
    expect(scaleNotes("D", "dorian", 4)).toEqual([
      "D4",
      "E4",
      "F4",
      "G4",
      "A4",
      "B4",
      "C5",
    ]);
  });

  it("spells C pentatonic minor as five notes", () => {
    expect(scaleNotes("C", "pentatonic minor", 3)).toEqual([
      "C3",
      "D#3",
      "F3",
      "G3",
      "A#3",
    ]);
  });

  it("accepts flat roots and spell aliases", () => {
    expect(scaleNotes("Bb", "minor", 3)[0]).toBe("A#3");
    expect(scaleNotes("C", "natural minor", 4)).toEqual(
      scaleNotes("C", "minor", 4),
    );
  });

  it("throws for an unknown scale", () => {
    expect(() => scaleNotes("C", "locrian", 4)).toThrow(/Unknown scale/);
  });

  it("reports the degree count for generators", () => {
    expect(scaleLength("major")).toBe(7);
    expect(scaleLength("pentatonic minor")).toBe(5);
  });
});

describe("degreeToNote", () => {
  it("treats degree 1 as the tonic and wraps octaves", () => {
    expect(degreeToNote("C", "major", 1)).toBe("C3");
    expect(degreeToNote("C", "major", 8)).toBe("C4");
    expect(degreeToNote("C", "major", 0)).toBe("B2");
  });

  it("wraps pentatonic degrees", () => {
    expect(degreeToNote("C", "pentatonic minor", 5)).toBe("A#3");
    expect(degreeToNote("C", "pentatonic minor", 6)).toBe("C4");
  });

  it("honours an explicit octave and octave in the root", () => {
    expect(degreeToNote("C", "major", 1, 5)).toBe("C5");
    expect(degreeToNote("C4", "major", 1)).toBe("C4");
  });

  it("rejects non-integer degrees", () => {
    expect(() => degreeToNote("C", "major", 1.5)).toThrow(/integer/);
  });
});

describe("romanToChord", () => {
  it("builds major-key diatonic triads", () => {
    expect(romanToChord("C", "major", "I")).toEqual(["C3", "E3", "G3"]);
    expect(romanToChord("C", "major", "ii")).toEqual(["D3", "F3", "A3"]);
    expect(romanToChord("C", "major", "V")).toEqual(["G3", "B3", "D4"]);
    expect(romanToChord("C", "major", "vi")).toEqual(["A3", "C4", "E4"]);
  });

  it("builds minor-key diatonic triads", () => {
    expect(romanToChord("A", "minor", "i")).toEqual(["A3", "C4", "E4"]);
    expect(romanToChord("A", "minor", "III")).toEqual(["C4", "E4", "G4"]);
    expect(romanToChord("A", "minor", "VI")).toEqual(["F4", "A4", "C5"]);
    expect(romanToChord("A", "minor", "VII")).toEqual(["G4", "B4", "D5"]);
  });

  it("applies explicit diminished markers without double-flattening", () => {
    expect(romanToChord("C", "major", "ii°")).toEqual(["D3", "F3", "G#3"]);
    expect(romanToChord("C", "major", "vii°")).toEqual(["B3", "D4", "F4"]);
  });

  it("adds a diatonic seventh for V7", () => {
    expect(romanToChord("C", "major", "V7")).toEqual(["G3", "B3", "D4", "F4"]);
  });

  it("uses minor harmony for pentatonic-minor chords", () => {
    expect(romanToChord("C", "pentatonic minor", "i")).toEqual([
      "C3",
      "D#3",
      "G3",
    ]);
  });

  it("throws for an invalid numeral", () => {
    expect(() => romanToChord("C", "major", "VIII")).toThrow(
      /Invalid roman numeral/,
    );
  });
});

describe("roman numeral helpers", () => {
  it("parses accidentals, case, quality, and extensions", () => {
    expect(parseRomanNumeral("bVII7")).toMatchObject({
      accidental: -1,
      degree: 7,
      isUpper: true,
      suffix: "7",
    });
    expect(romanToDegree("iv")).toBe(4);
    expect(romanToDegree("nope")).toBeNull();
  });

  it("shifts diatonically and changes case", () => {
    expect(shiftRomanNumeral("I", -2, "lower")).toBe("vi");
    expect(shiftRomanNumeral("i", 2, "upper")).toBe("III");
    expect(shiftRomanNumeral("VII", 1)).toBe("I");
  });

  it("strips extensions while keeping the triad", () => {
    expect(simplifyRomanNumeral("V7")).toBe("V");
    expect(simplifyRomanNumeral("ii°7")).toBe("ii°");
    expect(simplifyRomanNumeral("ivsus4")).toBe("iv");
  });
});

describe("midi helpers", () => {
  it("converts between names and MIDI numbers", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("A4")).toBe(69);
    expect(midiToNote(60)).toBe("C4");
    expect(midiToNote(61)).toBe("C#4");
  });
});
