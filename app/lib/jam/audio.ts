/**
 * Tone.js playback engine. Browser-only: Tone is imported lazily so SSR never
 * touches the Web Audio API. The engine reads the latest grid from `setState`
 * on every tick, so edits are heard immediately without rebuilding anything.
 */
import type * as ToneNS from "tone";
import type { SessionKit } from "../../../server/sessions/types";

import { degreeToNote, romanToChord } from "../../../server/music/notes";
import { STEPS_PER_BAR, type StepValue, type TrackData } from "./grid";

export type EngineState = {
  bpm: number;
  swing: number;
  root: string;
  scale: string;
  bars: number;
  tracks: TrackData[];
  kit?: SessionKit;
};

export type StepEvent = { kind: TrackData["kind"]; value: StepValue };

const VELOCITY = [0, 0.45, 0.75, 1];

export function eventsForStep(state: EngineState, step: number): StepEvent[] {
  const events: StepEvent[] = [];
  for (const track of state.tracks) {
    if (track.muted || (track.kind === "keys" && step % STEPS_PER_BAR !== 0))
      continue;
    const index =
      track.kind === "keys" ? Math.floor(step / STEPS_PER_BAR) : step;
    const value = track.steps[index];
    if (value === undefined || value === null || value === 0) continue;
    events.push({ kind: track.kind, value });
  }
  return events;
}

export function encodeAudioBufferWav(
  buffer: Pick<
    AudioBuffer,
    "numberOfChannels" | "length" | "sampleRate" | "getChannelData"
  >,
): Uint8Array {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const dataLength = buffer.length * channels * bytesPerSample;
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel]![frame]!));
      view.setInt16(
        offset,
        sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767),
        true,
      );
      offset += bytesPerSample;
    }
  }
  return wav;
}

/** All voices are synthesized locally. No samples or network assets. */
export const KIT_DEFINITIONS = {
  dusty: {
    label: "Dusty",
    description: "Soft drums, warm keys",
    masterCutoff: 4800,
    kickDecay: 0.28,
    pitchDecay: 0.055,
    octaves: 4,
    distortion: 0,
    snareCutoff: 2400,
    snareFilter: "lowpass",
    snareDecay: 0.14,
    snareBits: 9,
    snareBody: false,
    clapOffsets: [0],
    hatCutoff: 6200,
    hatDecay: 0.035,
    hatVolume: -23,
    hatBits: 12,
    bassWave: "triangle",
    bassCutoff: 500,
    bassDecay: 0.3,
    bassSustain: 0.35,
    bassDuration: "8n",
    bassOctave: 2,
    keysFm: true,
    keysWave: "triangle",
    keysCutoff: 1800,
    keysAttack: 0.015,
    keysDecay: 0.7,
    keysSustain: 0.2,
  },
  boombap: {
    label: "Boom-bap",
    description: "Punchy drums, warm bass",
    masterCutoff: 9000,
    kickDecay: 0.22,
    pitchDecay: 0.025,
    octaves: 5,
    distortion: 0.18,
    snareCutoff: 1700,
    snareFilter: "highpass",
    snareDecay: 0.12,
    snareBits: 10,
    snareBody: true,
    clapOffsets: [0],
    hatCutoff: 6000,
    hatDecay: 0.05,
    hatVolume: -19,
    hatBits: 8,
    bassWave: "sawtooth",
    bassCutoff: 650,
    bassDecay: 0.25,
    bassSustain: 0.45,
    bassDuration: "8n",
    bassOctave: 2,
    keysFm: true,
    keysWave: "sine",
    keysCutoff: 2600,
    keysAttack: 0.008,
    keysDecay: 0.9,
    keysSustain: 0.15,
  },
  "808": {
    label: "808",
    description: "Deep subs, sharp claps",
    masterCutoff: 18000,
    kickDecay: 0.8,
    pitchDecay: 0.07,
    octaves: 3,
    distortion: 0,
    snareCutoff: 1200,
    snareFilter: "highpass",
    snareDecay: 0.065,
    snareBits: 0,
    snareBody: false,
    clapOffsets: [0, 0.01, 0.02],
    hatCutoff: 9500,
    hatDecay: 0.018,
    hatVolume: -20,
    hatBits: 0,
    bassWave: "sine",
    bassCutoff: 280,
    bassDecay: 1.4,
    bassSustain: 0,
    bassDuration: "2n",
    bassOctave: 1,
    keysFm: false,
    keysWave: "triangle",
    keysCutoff: 1200,
    keysAttack: 0.18,
    keysDecay: 0.6,
    keysSustain: 0.6,
  },
  clean: {
    label: "Clean",
    description: "Crisp drums, bright plucks",
    masterCutoff: 20000,
    kickDecay: 0.16,
    pitchDecay: 0.018,
    octaves: 5,
    distortion: 0,
    snareCutoff: 2200,
    snareFilter: "highpass",
    snareDecay: 0.1,
    snareBits: 0,
    snareBody: false,
    clapOffsets: [0],
    hatCutoff: 8000,
    hatDecay: 0.028,
    hatVolume: -18,
    hatBits: 0,
    bassWave: "square",
    bassCutoff: 1400,
    bassDecay: 0.13,
    bassSustain: 0,
    bassDuration: "16n",
    bassOctave: 2,
    keysFm: false,
    keysWave: "triangle",
    keysCutoff: 8000,
    keysAttack: 0.002,
    keysDecay: 0.18,
    keysSustain: 0,
  },
} as const satisfies Record<SessionKit, object>;

export type KitVoices = ReturnType<typeof createKitVoices>;

/** Shared by live playback, cell previews, and offline export. Does not start audio. */
export function createKitVoices(Tone: typeof ToneNS, kit: SessionKit) {
  const config = KIT_DEFINITIONS[kit];
  const nodes: Array<{ dispose(): unknown }> = [];
  const own = <T extends { dispose(): unknown }>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const limiter = own(new Tone.Limiter(-2).toDestination());
  const gain = own(new Tone.Gain(1).connect(limiter));
  const master = own(
    new Tone.Filter(config.masterCutoff, "lowpass").connect(gain),
  );
  const kickOut = config.distortion
    ? own(
        new Tone.Distortion({
          distortion: config.distortion,
          wet: 0.25,
        }).connect(master),
      )
    : master;
  const kick = own(
    new Tone.MembraneSynth({
      pitchDecay: config.pitchDecay,
      octaves: config.octaves,
      envelope: {
        attack: 0.001,
        decay: config.kickDecay,
        sustain: 0,
        release: 0.08,
      },
      volume: kit === "808" ? -9 : -5,
    }).connect(kickOut),
  );
  const snareFilter = own(
    new Tone.Filter(config.snareCutoff, config.snareFilter).connect(master),
  );
  const snareOut = config.snareBits
    ? own(new Tone.BitCrusher(config.snareBits).connect(snareFilter))
    : snareFilter;
  // Separate noise envelopes let the three clap bursts overlap naturally.
  const snares = config.clapOffsets.map(() =>
    own(
      new Tone.NoiseSynth({
        noise: { type: kit === "dusty" ? "pink" : "white" },
        envelope: {
          attack: 0.001,
          decay: config.snareDecay,
          sustain: 0,
          release: 0.02,
        },
        volume: kit === "808" ? -16 : -11,
      }).connect(snareOut),
    ),
  );
  const snareBody = config.snareBody
    ? own(
        new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
          volume: -14,
        }).connect(master),
      )
    : null;
  const hatFilter = own(
    new Tone.Filter(config.hatCutoff, "highpass").connect(master),
  );
  const hatOut = config.hatBits
    ? own(new Tone.BitCrusher(config.hatBits).connect(hatFilter))
    : hatFilter;
  const hat = own(
    new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: config.hatDecay,
        sustain: 0,
        release: 0.005,
      },
      volume: config.hatVolume,
    }).connect(hatOut),
  );
  const bassFilter = own(
    new Tone.Filter(config.bassCutoff, "lowpass").connect(master),
  );
  // MembraneSynth gives the 808 bass a small initial pitch fall, separate from the kick.
  const bass =
    kit === "808"
      ? own(
          new Tone.MembraneSynth({
            oscillator: { type: "sine" },
            pitchDecay: 0.025,
            octaves: 0.25,
            envelope: {
              attack: 0.008,
              decay: config.bassDecay,
              sustain: 0,
              release: 0.2,
            },
            volume: -7,
          }).connect(bassFilter),
        )
      : own(
          new Tone.MonoSynth({
            oscillator: { type: config.bassWave },
            envelope: {
              attack: 0.008,
              decay: config.bassDecay,
              sustain: config.bassSustain,
              release: 0.12,
            },
            filterEnvelope: {
              attack: 0.002,
              decay: 0.18,
              sustain: 0.2,
              release: 0.12,
              baseFrequency: 100,
              octaves: 2.5,
            },
            volume: -8,
          }).connect(bassFilter),
        );
  const keysFilter = own(
    new Tone.Filter(config.keysCutoff, "lowpass").connect(master),
  );
  const keysOptions = {
    oscillator: { type: config.keysWave },
    envelope: {
      attack: config.keysAttack,
      decay: config.keysDecay,
      sustain: config.keysSustain,
      release: kit === "808" ? 1.1 : 0.45,
    },
    volume: -17,
  };
  const keys = config.keysFm
    ? own(
        new Tone.PolySynth(Tone.FMSynth, {
          ...keysOptions,
          harmonicity: 2,
          modulationIndex: 1.5,
        }).connect(keysFilter),
      )
    : own(new Tone.PolySynth(Tone.Synth, keysOptions).connect(keysFilter));
  return {
    kit,
    config,
    kick,
    snares,
    snareBody,
    hat,
    bass,
    keys,
    gain,
    dispose: () => {
      for (const node of nodes.reverse()) node.dispose();
    },
  };
}

function playKitValue(
  voices: KitVoices,
  kind: TrackData["kind"],
  value: StepValue | undefined,
  time: number,
  state: EngineState,
  shortKeys = false,
): void {
  if (value === null || value === undefined || value === 0 || value === "")
    return;
  const vel = typeof value === "number" ? (VELOCITY[value] ?? 0.75) : 0.75;
  try {
    switch (kind) {
      case "kick":
        voices.kick.triggerAttackRelease(
          "C1",
          voices.config.kickDecay,
          time,
          vel,
        );
        break;
      case "snare":
        voices.snares.forEach((snare, i) =>
          snare.triggerAttackRelease(
            voices.config.snareDecay,
            time + voices.config.clapOffsets[i]!,
            vel,
          ),
        );
        voices.snareBody?.triggerAttackRelease(200, 0.07, time, vel);
        break;
      case "hat":
        voices.hat.triggerAttackRelease(voices.config.hatDecay, time, vel);
        break;
      case "bass":
        if (typeof value === "number")
          voices.bass.triggerAttackRelease(
            degreeToNote(
              state.root,
              state.scale,
              value,
              voices.config.bassOctave,
            ),
            voices.config.bassDuration,
            time,
            0.9,
          );
        break;
      case "keys":
        if (typeof value === "string")
          voices.keys.triggerAttackRelease(
            romanToChord(state.root, state.scale, value, 3),
            shortKeys ? "2n" : "1m",
            time,
            0.6,
          );
        break;
    }
  } catch {
    // Invalid notes must never interrupt the loop.
  }
}

/** Offline rendering never connects to the live destination. */
export async function renderOffline(
  state: EngineState,
  seconds: number,
): Promise<AudioBuffer> {
  const Tone = await import("tone");
  const output = await Tone.Offline(
    ({ transport }) => {
      const voices = createKitVoices(Tone, state.kit ?? "dusty");
      transport.bpm.value = state.bpm;
      transport.swing = state.swing;
      let counter = 0;
      transport.scheduleRepeat((time) => {
        const step = counter++ % (state.bars * STEPS_PER_BAR);
        for (const event of eventsForStep(state, step))
          playKitValue(voices, event.kind, event.value, time, state);
      }, "16n");
      transport.start(0);
    },
    seconds,
    2,
    44100,
  );
  return output.get() as AudioBuffer;
}

type Listener = (step: number) => void;

export class JamEngine {
  private Tone: typeof ToneNS | null = null;
  private initPromise: Promise<void> | null = null;
  private state: EngineState | null = null;
  private counter = 0;
  private eventId: number | null = null;
  private listeners = new Set<Listener>();
  playing = false;

  private voices: KitVoices | null = null;
  private retired = new Map<KitVoices, ReturnType<typeof setTimeout>>();

  /** Must be called from a user gesture the first time. */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.build();
    return this.initPromise;
  }

  private async build(): Promise<void> {
    const Tone = await import("tone");
    this.Tone = Tone;
    await Tone.start();
    this.voices = createKitVoices(Tone, this.state?.kit ?? "dusty");
    this.eventId = Tone.getTransport().scheduleRepeat(
      (time) => this.tick(time),
      "16n",
    );
    this.applyTransport();
  }

  private swapKit(time: number): void {
    if (!this.Tone) return;
    const kit = this.state?.kit ?? "dusty";
    if (this.voices?.kit === kit) return;
    const next = createKitVoices(this.Tone, kit);
    const previous = this.voices;
    this.voices = next;
    next.gain.gain.setValueAtTime(0, time);
    next.gain.gain.linearRampToValueAtTime(1, time + 0.012);
    if (previous) {
      previous.gain.gain.setValueAtTime(1, time);
      previous.gain.gain.linearRampToValueAtTime(0, time + 0.012);
      this.retired.set(
        previous,
        setTimeout(
          () => {
            previous.dispose();
            this.retired.delete(previous);
          },
          Math.max(0, time - this.Tone.now()) * 1000 + 150,
        ),
      );
    }
  }

  setState(state: EngineState): void {
    this.state = state;
    if (this.Tone && this.voices && !this.playing)
      this.swapKit(this.Tone.now());
    this.applyTransport();
  }

  private applyTransport(): void {
    if (!this.Tone || !this.state) return;
    const transport = this.Tone.getTransport();
    transport.bpm.value = this.state.bpm;
    transport.swing = this.state.swing;
  }

  onStep(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    await this.init();
    if (!this.Tone || this.playing) return;
    this.counter = 0;
    this.playing = true;
    this.applyTransport();
    this.Tone.getTransport().start("+0.05");
  }

  stop(): void {
    if (!this.Tone || !this.playing) return;
    const transport = this.Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.playing = false;
    this.counter = 0;
    for (const listener of this.listeners) listener(-1);
  }

  private tick(time: number): void {
    const Tone = this.Tone;
    const state = this.state;
    if (!Tone || !state) return;
    const total = state.bars * STEPS_PER_BAR;
    const step = this.counter % total;
    this.counter += 1;
    if (step % STEPS_PER_BAR === 0) this.swapKit(time);

    for (const event of eventsForStep(state, step))
      this.playValue(event.kind, event.value, time, state);

    Tone.getDraw().schedule(() => {
      if (!this.playing) return;
      for (const listener of this.listeners) listener(step);
    }, time);
  }

  private playValue(
    kind: TrackData["kind"],
    value: StepValue | undefined,
    time: number,
    state: EngineState,
  ): void {
    if (this.voices) playKitValue(this.voices, kind, value, time, state);
  }

  /** Immediate one-shot so a clicked cell is heard even when stopped. */
  async preview(kind: TrackData["kind"], value: StepValue): Promise<void> {
    await this.init();
    if (!this.Tone || !this.state || !this.voices) return;
    playKitValue(this.voices, kind, value, this.Tone.now(), this.state, true);
  }

  dispose(): void {
    this.stop();
    if (this.Tone && this.eventId !== null)
      this.Tone.getTransport().clear(this.eventId);
    this.eventId = null;
    this.voices?.dispose();
    this.voices = null;
    for (const [voices, timer] of this.retired) {
      clearTimeout(timer);
      voices.dispose();
    }
    this.retired.clear();
    this.initPromise = null;
  }
}

let shared: JamEngine | null = null;
export function getJamEngine(): JamEngine {
  shared ??= new JamEngine();
  return shared;
}
