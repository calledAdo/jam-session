import { describe, expect, it } from "vitest";

import {
  activeStepRatio,
  bassNoteName,
  adjacentStep,
  chordName,
  chordChoices,
  pageBars,
  barLeft,
  barWidth,
  cycleDraftDrum,
  draftCells,
  draftPatchForIdea,
  draftRegions,
  draftValueAt,
  gridMetricsForWidth,
  isDraftCell,
  MIN_CELL_W,
  patchPreviewRows,
  selectionBounds,
  setDraftChord,
  stepX,
  toggleDraftCell,
  type TrackData,
} from "./grid";

describe("activeStepRatio", () => {
  it("returns the proportion of active numeric steps", () => {
    expect(activeStepRatio([0, 1, null, 2, "i"])).toBe(0.4);
  });

  it("returns zero for an empty track", () => {
    expect(activeStepRatio([])).toBe(0);
  });
});

describe("patchPreviewRows", () => {
  it("groups changed cells by track and zero-based bar", () => {
    const tracks: TrackData[] = [
      {
        kind: "kick",
        steps: Array.from({ length: 32 }, (_, index) => (index === 17 ? 1 : 0)),
      },
      { kind: "keys", steps: ["i", "VI"] },
    ];

    expect(
      patchPreviewRows(tracks, [
        { track: "kick", fromStep: 17, steps: [2, 1] },
        { track: "keys", fromStep: 1, steps: ["VII"] },
      ]),
    ).toEqual([
      {
        track: "kick",
        bar: 1,
        before: Array.from({ length: 16 }, (_, index) => (index === 1 ? 1 : 0)),
        after: Array.from({ length: 16 }, (_, index) =>
          index === 1 ? 2 : index === 2 ? 1 : 0,
        ),
        changed: [1, 2],
      },
      {
        track: "keys",
        bar: 1,
        before: ["VI"],
        after: ["VII"],
        changed: [0],
      },
    ]);
  });

  it("omits no-op and out-of-range patch cells", () => {
    const tracks: TrackData[] = [{ kind: "hat", steps: [0, 1] }];

    expect(
      patchPreviewRows(tracks, [
        { track: "hat", fromStep: 0, steps: [0, 2, 1] },
      ]),
    ).toEqual([
      {
        track: "hat",
        bar: 0,
        before: [0, 1],
        after: [0, 2],
        changed: [1],
      },
    ]);
  });
});

describe("draft editing helpers", () => {
  const tracks: TrackData[] = [
    { kind: "kick", steps: Array.from({ length: 32 }, () => 0) },
    {
      kind: "bass",
      steps: Array.from({ length: 32 }, (_, index) =>
        index === 16 ? 1 : null,
      ),
    },
    { kind: "keys", steps: ["i", "VI"] },
  ];

  const patch = [
    { track: "kick" as const, fromStep: 16, steps: [2, 0, 1] },
    { track: "bass" as const, fromStep: 16, steps: [1] },
    { track: "keys" as const, fromStep: 1, steps: ["VII"] },
  ];

  it("scopes a draft to the regions the idea touches", () => {
    expect(draftRegions(patch)).toEqual([
      { track: "kick", start: 16, end: 31 },
      { track: "bass", start: 16, end: 31 },
      { track: "keys", start: 1, end: 1 },
    ]);
  });

  it("seeds the draft with the idea applied to the current grid", () => {
    const draft = draftPatchForIdea(tracks, patch);

    expect(draftCells(draft)).toEqual([
      ...Array.from({ length: 16 }, (_, i) => `kick:${16 + i}`),
      ...Array.from({ length: 16 }, (_, i) => `bass:${16 + i}`),
      "keys:1",
    ]);
    expect(draftValueAt(tracks, draft, "kick", 16)).toBe(2);
    expect(draftValueAt(tracks, draft, "keys", 1)).toBe("VII");
    expect(isDraftCell(draft, "kick", 19)).toBe(true);
    const toggled = toggleDraftCell(tracks, draft, "kick", 31);
    expect(draftValueAt(tracks, toggled, "kick", 31)).toBe(1);
    expect(tracks[0]!.steps[31]).toBe(0);
    expect(isDraftCell(draft, "kick", 15)).toBe(false);
  });

  it("cycles drum velocity off -> 1 -> 2 -> 3 -> off", () => {
    expect(cycleDraftDrum(0)).toBe(1);
    expect(cycleDraftDrum(1)).toBe(2);
    expect(cycleDraftDrum(2)).toBe(3);
    expect(cycleDraftDrum(3)).toBe(0);
    expect(cycleDraftDrum(null)).toBe(1);
  });

  it("toggles bass cells and shifts the keys chord inside the draft", () => {
    const draft = draftPatchForIdea(tracks, patch);
    const off = toggleDraftCell(tracks, draft, "bass", 16);

    expect(draftValueAt(tracks, off, "bass", 16)).toBeNull();
    const withChord = setDraftChord(draft, 1, "iv");
    expect(draftValueAt(tracks, withChord, "keys", 1)).toBe("iv");
  });

  it("leaves cells outside the draft untouched", () => {
    const draft = draftPatchForIdea(tracks, patch);
    const toggled = toggleDraftCell(tracks, draft, "kick", 4);

    expect(toggled).toBe(draft);
    expect(draftCells(toggled)).not.toContain("kick:4");
    expect(setDraftChord(draft, 0, "V")).toBe(draft);
  });
});

describe("responsive grid metrics", () => {
  it("fits 8 bars in a 1920px window with the sidebar open and keeps positions aligned", () => {
    const metrics = gridMetricsForWidth(1472, 8);

    expect(metrics.cellW).toBeGreaterThanOrEqual(MIN_CELL_W);
    expect(metrics.bodyWidth).toBeLessThanOrEqual(1472);
    expect(metrics.bodyWidth).toBeGreaterThan(1472 - 16);
    expect(stepX(4, metrics)).toBe(metrics.groupPitch);
    expect(stepX(16, metrics)).toBe(metrics.barPitch);
    expect(barLeft(1, metrics)).toBe(metrics.barPitch);
    expect(barWidth(metrics)).toBe(metrics.barPitch - metrics.barGap);
    expect(selectionBounds(2, 3, metrics)).toEqual({
      left: 2 * metrics.barPitch,
      width: 2 * metrics.barPitch - metrics.barGap,
    });
  });

  it("stops shrinking at the minimum cell width and scrolls when the viewport is too narrow", () => {
    const metrics = gridMetricsForWidth(900, 8);

    expect(metrics.cellW).toBe(MIN_CELL_W);
    expect(metrics.bodyWidth).toBeGreaterThan(900);
  });

  it("caps cells at the existing 18px size when there is room", () => {
    const metrics = gridMetricsForWidth(4000, 8);

    expect(metrics.cellW).toBe(18);
    expect(metrics.barPitch).toBe(348);
    expect(metrics.bodyWidth).toBe(2784);
  });
});

describe("sketchbook presentation", () => {
  it("shows the actual sounding chords without changing saved numerals", () => {
    expect(chordName("C", "minor", "i")).toBe("Cm");
    expect(chordName("C", "minor", "VI")).toBe("A♭");
    expect(chordName("D", "major", "V")).toBe("A");
    expect(chordName("C", "major", "vii°")).toBe("Bdim");
    expect(chordName("C", "dorian", "IV")).toBe("F");
    expect(chordName("C", "pentatonic minor", "VI")).toBe("A♭");
    expect(chordName("C", "minor", "bad input")).toBe("Chord");
  });
  it("groups the picker by the actual chord quality", () => {
    expect(chordChoices("C", "minor")).toEqual(
      expect.arrayContaining([
        { numeral: "i", name: "Cm", group: "Sad" },
        { numeral: "VI", name: "A♭", group: "Bright" },
        { numeral: "ii°", name: "Ddim", group: "Tense" },
      ]),
    );
  });
  it("pages at phone, tablet and desktop sizes without losing the absolute bar", () => {
    expect(pageBars(3, 8, 1)).toEqual([3]);
    expect(pageBars(3, 8, 2)).toEqual([2, 3]);
    expect(pageBars(7, 8, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(pageBars(4, 5, 2)).toEqual([4]);
    expect(pageBars(99, 8, 1)).toEqual([7]);
    expect(pageBars(-1, 8, 1)).toEqual([0]);
    expect(pageBars(0, 0, 1)).toEqual([]);
  });
});

describe("beginner note labels", () => {
  it("resolves bass degrees using the same scale as playback", () => {
    expect(bassNoteName("D", "minor", 1)).toBe("D");
    expect(bassNoteName("D", "minor", 3)).toBe("F");
    expect(bassNoteName("F", "minor", 8)).toBe("F");
    expect(bassNoteName("C", "pentatonic minor", 6)).toBe("C");
  });
  it("labels rests and invalid data without inventing a sounding note", () => {
    for (const value of [null, 0, -1, 1.2, "i"])
      expect(bassNoteName("C", "minor", value)).toBe("—");
    expect(bassNoteName("bad", "minor", 1)).toBe("—");
  });
});

describe("focused bar keyboard navigation", () => {
  it("moves between phone beat rows without leaving the bar", () => {
    expect(adjacentStep(2, "ArrowDown", true)).toBe(6);
    expect(adjacentStep(6, "ArrowUp", true)).toBe(2);
    expect(adjacentStep(0, "ArrowLeft", true)).toBe(0);
    expect(adjacentStep(15, "ArrowRight", true)).toBe(15);
    expect(adjacentStep(13, "ArrowDown", true)).toBe(15);
  });
  it("preserves a desktop row on vertical arrows", () => {
    expect(adjacentStep(7, "ArrowUp", false)).toBe(7);
    expect(adjacentStep(7, "ArrowRight", false)).toBe(8);
  });
});
