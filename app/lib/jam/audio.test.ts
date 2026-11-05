import { describe, expect, it, vi } from "vitest";

import {
  encodeAudioBufferWav,
  eventsForStep,
  createKitVoices,
  KIT_DEFINITIONS,
  JamEngine,
} from "./audio.js";

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

// No AudioContext: these nodes only record the graph and scheduled parameters.
function mockTone() {
  class Node {
    volume = { value: 0 };
    gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    triggerAttackRelease = vi.fn();
    dispose = vi.fn();
    connect = vi.fn().mockReturnValue(this);
    toDestination = vi.fn().mockReturnValue(this);
    constructor(public options?: unknown) {}
  }
  const instances: Node[] = [];
  const constructor = () =>
    vi.fn(function (this: unknown, options?: unknown) {
      const node = new Node(options);
      instances.push(node);
      return node;
    });
  let tick: (time: number) => void = () => {};
  const transport = {
    bpm: { value: 90 },
    swing: 0,
    position: 0,
    scheduleRepeat: vi.fn((callback: (time: number) => void) => {
      tick = callback;
      return 1;
    }),
    start: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
  };
  const tone = {
    Limiter: constructor(),
    Gain: constructor(),
    Filter: constructor(),
    Distortion: constructor(),
    MembraneSynth: constructor(),
    NoiseSynth: constructor(),
    BitCrusher: constructor(),
    Synth: constructor(),
    MonoSynth: constructor(),
    PolySynth: constructor(),
    FMSynth: constructor(),
    now: () => 0,
    start: vi.fn().mockResolvedValue(undefined),
    getTransport: () => transport,
    getDraw: () => ({ schedule: vi.fn() }),
  };
  return { tone, instances, transport, tick: (time = 0) => tick(time) };
}

describe("synthesized kits", () => {
  it("keeps four distinct palettes with the requested characters", () => {
    expect(new Set(Object.keys(KIT_DEFINITIONS))).toEqual(
      new Set(["dusty", "boombap", "808", "clean"]),
    );
    const { dusty, boombap, clean } = KIT_DEFINITIONS;
    const trap = KIT_DEFINITIONS["808"];
    expect(dusty.masterCutoff).toBeLessThan(clean.masterCutoff);
    expect(dusty.hatVolume).toBeLessThan(clean.hatVolume);
    expect(dusty.snareBits).toBeGreaterThan(0);
    expect(boombap.snareBody).toBe(true);
    expect(boombap.distortion).toBeGreaterThan(0);
    expect(boombap.bassWave).toBe("sawtooth");
    expect(trap.clapOffsets).toEqual([0, 0.01, 0.02]);
    expect(trap.bassWave).toBe("sine");
    expect(trap.bassDecay).toBeGreaterThan(1);
    expect(trap.bassOctave).toBe(1);
    expect(clean.bassSustain).toBe(0);
  });

  it.each(["dusty", "boombap", "808", "clean"] as const)(
    "builds and disposes the complete %s graph without starting audio",
    (kit) => {
      const { tone, instances } = mockTone();
      const voices = createKitVoices(
        tone as unknown as typeof import("tone"),
        kit,
      );
      expect(tone.start).not.toHaveBeenCalled();
      expect(voices.kit).toBe(kit);
      expect(voices.snares).toHaveLength(kit === "808" ? 3 : 1);
      expect(Boolean(voices.snareBody)).toBe(kit === "boombap");
      expect(tone.MembraneSynth).toHaveBeenCalledTimes(kit === "808" ? 2 : 1);
      expect(tone.PolySynth.mock.calls[0]?.[0]).toBe(
        kit === "dusty" || kit === "boombap" ? tone.FMSynth : tone.Synth,
      );
      voices.dispose();
      expect(
        instances.every((node) => node.dispose.mock.calls.length === 1),
      ).toBe(true);
    },
  );

  it("swaps voices at the next bar without stopping or rescheduling transport", async () => {
    vi.useFakeTimers();
    const mock = mockTone();
    vi.doMock("tone", () => mock.tone);
    const engine = new JamEngine();
    const state = {
      bpm: 90,
      root: "D",
      scale: "minor",
      swing: 0.3,
      bars: 8,
      tracks: [],
      kit: "dusty" as const,
    };
    try {
      engine.setState(state);
      expect(mock.instances).toHaveLength(0);
      // init/start operate only on the fake module above; no browser audio exists.
      await engine.start();
      mock.tick(); // first step
      const count = mock.tone.MembraneSynth.mock.calls.length;
      engine.setState({ ...state, kit: "808" });
      for (let step = 1; step < 16; step++) mock.tick();
      expect(mock.tone.MembraneSynth).toHaveBeenCalledTimes(count);
      mock.tick(); // next bar
      expect(mock.tone.MembraneSynth).toHaveBeenCalledTimes(count + 2);
      expect(mock.transport.start).toHaveBeenCalledTimes(1);
      expect(mock.transport.stop).not.toHaveBeenCalled();
      expect(mock.transport.scheduleRepeat).toHaveBeenCalledTimes(1);
      expect(engine.playing).toBe(true);
      await vi.runAllTimersAsync();
      expect(
        mock.instances.some((node) => node.dispose.mock.calls.length),
      ).toBe(true);
      engine.dispose();
      expect(
        mock.instances.every((node) => node.dispose.mock.calls.length === 1),
      ).toBe(true);
    } finally {
      engine.dispose();
      vi.doUnmock("tone");
      vi.useRealTimers();
    }
  });
});
