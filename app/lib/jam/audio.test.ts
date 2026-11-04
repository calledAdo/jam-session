import { describe, expect, it } from "vitest";

import { encodeAudioBufferWav, eventsForStep } from "./audio.js";

describe("eventsForStep", () => {
  it("returns active track events and chords only on bar boundaries", () => {
    const state = {
      bpm: 82,
      swing: 0,
      root: "C",
      scale: "minor",
      bars: 2,
      tracks: [
        {
          kind: "kick" as const,
          steps: Array.from({ length: 17 }, (_, step) =>
            step === 0 ? 1 : step === 16 ? 2 : 0,
          ),
        },
        { kind: "snare" as const, steps: [2, 2], muted: true },
        { kind: "hat" as const, steps: [0, 3, 0] },
        { kind: "bass" as const, steps: [null, 4, null] },
        { kind: "keys" as const, steps: ["i", "VI"] },
      ],
    };

    expect(eventsForStep(state, 0)).toEqual([
      { kind: "kick", value: 1 },
      { kind: "keys", value: "i" },
    ]);
    expect(eventsForStep(state, 1)).toEqual([
      { kind: "hat", value: 3 },
      { kind: "bass", value: 4 },
    ]);
    expect(eventsForStep(state, 16)).toEqual([
      { kind: "kick", value: 2 },
      { kind: "keys", value: "VI" },
    ]);
  });
});

describe("encodeAudioBufferWav", () => {
  it("writes a stereo PCM16 WAV header and interleaves clamped samples", () => {
    const channels = [new Float32Array([-1, 0.5]), new Float32Array([1, -0.5])];
    const wav = encodeAudioBufferWav({
      numberOfChannels: 2,
      length: 2,
      sampleRate: 44100,
      getChannelData: (channel) => channels[channel]!,
    });
    const view = new DataView(wav.buffer);

    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(40, true)).toBe(8);
    expect([
      view.getInt16(44, true),
      view.getInt16(46, true),
      view.getInt16(48, true),
      view.getInt16(50, true),
    ]).toEqual([-32768, 32767, 16384, -16384]);
  });
});
