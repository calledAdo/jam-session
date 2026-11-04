/**
 * Tone.js playback engine. Browser-only: Tone is imported lazily so SSR never
 * touches the Web Audio API. The engine reads the latest grid from `setState`
 * on every tick, so edits are heard immediately without rebuilding anything.
 */
import type * as ToneNS from "tone";

import {
  degreeToNote,
  romanToChord,
} from "../../../server/music/notes";
import { STEPS_PER_BAR, type StepValue, type TrackData } from "./grid";

export type EngineState = {
  bpm: number;
  swing: number;
  root: string;
  scale: string;
  bars: number;
  tracks: TrackData[];
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
      const sample = Math.max(
        -1,
        Math.min(1, channelData[channel]![frame]!),
      );
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

/** Render a silent-by-default offline take from the same synth palette as JamEngine. */
export async function renderOffline(
  state: EngineState,
  seconds: number,
): Promise<AudioBuffer> {
  const Tone = await import("tone");
  const output = await Tone.Offline(
    async ({ transport }) => {
      const master = new Tone.Limiter(-2).toDestination();
      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      }).connect(master);
      kick.volume.value = -4;

      const snareFilter = new Tone.Filter(1800, "highpass").connect(master);
      const snare = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.05 },
      }).connect(snareFilter);
      snare.volume.value = -8;

      const hatFilter = new Tone.Filter(7500, "highpass").connect(master);
      const hat = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      }).connect(hatFilter);
      hat.volume.value = -18;

      const bassFilter = new Tone.Filter(520, "lowpass").connect(master);
      const bass = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.15 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.3,
          release: 0.2,
          baseFrequency: 120,
          octaves: 2.5,
        },
      }).connect(bassFilter);
      bass.volume.value = -6;

      const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.2 });
      await reverb.ready;
      reverb.connect(master);
      const lofi = new Tone.Filter(1600, "lowpass").connect(reverb);
      const keys = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.04, decay: 0.3, sustain: 0.4, release: 0.8 },
      }).connect(lofi);
      keys.volume.value = -14;

      transport.bpm.value = state.bpm;
      transport.swing = state.swing;
      let counter = 0;
      transport.scheduleRepeat((time) => {
        const step = counter % (state.bars * STEPS_PER_BAR);
        counter += 1;
        for (const event of eventsForStep(state, step)) {
          const velocity =
            typeof event.value === "number"
              ? (VELOCITY[event.value] ?? 0.75)
              : 0.75;
          switch (event.kind) {
            case "kick":
              kick.triggerAttackRelease("C1", "8n", time, velocity);
              break;
            case "snare":
              snare.triggerAttackRelease("16n", time, velocity);
              break;
            case "hat":
              hat.triggerAttackRelease("32n", time, velocity);
              break;
            case "bass":
              if (typeof event.value === "number")
                bass.triggerAttackRelease(
                  degreeToNote(state.root, state.scale, event.value, 2),
                  "8n",
                  time,
                  0.9,
                );
              break;
            case "keys":
              if (typeof event.value === "string")
                keys.triggerAttackRelease(
                  romanToChord(state.root, state.scale, event.value, 3),
                  "1m",
                  time,
                  0.6,
                );
              break;
          }
        }
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

  private kick!: ToneNS.MembraneSynth;
  private snare!: ToneNS.NoiseSynth;
  private hat!: ToneNS.NoiseSynth;
  private bass!: ToneNS.MonoSynth;
  private keys!: ToneNS.PolySynth;

  /** Must be called from a user gesture the first time. */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.build();
    return this.initPromise;
  }

  private async build(): Promise<void> {
    const Tone = await import("tone");
    this.Tone = Tone;
    await Tone.start();

    const master = new Tone.Limiter(-2).toDestination();

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(master);
    this.kick.volume.value = -4;

    const snareFilter = new Tone.Filter(1800, "highpass").connect(master);
    this.snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.05 },
    }).connect(snareFilter);
    this.snare.volume.value = -8;

    const hatFilter = new Tone.Filter(7500, "highpass").connect(master);
    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    }).connect(hatFilter);
    this.hat.volume.value = -18;

    const bassFilter = new Tone.Filter(520, "lowpass").connect(master);
    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.15 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.2,
        baseFrequency: 120,
        octaves: 2.5,
      },
    }).connect(bassFilter);
    this.bass.volume.value = -6;

    const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.2 });
    await reverb.generate();
    reverb.connect(master);
    const lofi = new Tone.Filter(1600, "lowpass").connect(reverb);
    this.keys = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.04, decay: 0.3, sustain: 0.4, release: 0.8 },
    }).connect(lofi);
    this.keys.volume.value = -14;

    Tone.getTransport().scheduleRepeat((time) => this.tick(time), "16n");
    this.applyTransport();
  }

  setState(state: EngineState): void {
    this.state = state;
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
    if (value === null || value === undefined || value === 0) return;
    const vel = typeof value === "number" ? (VELOCITY[value] ?? 0.75) : 0.75;
    try {
      switch (kind) {
        case "kick":
          this.kick.triggerAttackRelease("C1", "8n", time, vel);
          break;
        case "snare":
          this.snare.triggerAttackRelease("16n", time, vel);
          break;
        case "hat":
          this.hat.triggerAttackRelease("32n", time, vel);
          break;
        case "bass":
          if (typeof value === "number") {
            this.bass.triggerAttackRelease(
              degreeToNote(state.root, state.scale, value, 2),
              "8n",
              time,
              0.9,
            );
          }
          break;
        case "keys":
          if (typeof value === "string") {
            this.keys.triggerAttackRelease(
              romanToChord(state.root, state.scale, value, 3),
              "1m",
              time,
              0.6,
            );
          }
          break;
      }
    } catch {
      // A bad numeral or note must never stop the loop.
    }
  }

  /** Immediate one-shot so a clicked cell is heard even when stopped. */
  async preview(kind: TrackData["kind"], value: StepValue): Promise<void> {
    await this.init();
    if (!this.Tone || !this.state) return;
    const state = this.state;
    const time = this.Tone.now();
    if (kind === "keys" && typeof value === "string") {
      try {
        this.keys.triggerAttackRelease(
          romanToChord(state.root, state.scale, value, 3),
          "2n",
          time,
          0.6,
        );
      } catch {
        // ignore
      }
      return;
    }
    this.playValue(kind, value, time, state);
  }

  dispose(): void {
    this.stop();
  }
}

let shared: JamEngine | null = null;
export function getJamEngine(): JamEngine {
  shared ??= new JamEngine();
  return shared;
}
