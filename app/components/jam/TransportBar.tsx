import {
  IconBolt,
  IconMinus,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconPlus,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { ControlsStrip } from "./controls/ControlsStrip";

import "./jam.css";

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = ["major", "minor", "dorian", "pentatonic minor"];

export type TransportBarProps = {
  bpm: number;
  root: string;
  scale: string;
  swing: number;
  playing: boolean;
  onTogglePlay: () => void;
  onChange: (
    patch: Partial<{ bpm: number; root: string; scale: string; swing: number }>,
  ) => void;
  onUnstick: () => void;
  notice: string | null;
  sessionId?: string;
  hatEnergy: number;
};

export function TransportBar(props: TransportBarProps) {
  const [bpmDraft, setBpmDraft] = useState(String(props.bpm));
  useEffect(() => setBpmDraft(String(props.bpm)), [props.bpm]);

  const commitBpm = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return setBpmDraft(String(props.bpm));
    const clamped = Math.min(240, Math.max(40, n));
    setBpmDraft(String(clamped));
    if (clamped !== props.bpm) props.onChange({ bpm: clamped });
  };

  return (
    <div className="jam-transport-stack">
      <div className="jam-transport" role="group" aria-label="Loop transport">
        <button
          type="button"
          className="jam-play-button"
          data-playing={props.playing ? "true" : "false"}
          onClick={props.onTogglePlay}
          title={props.playing ? "Stop loop (Space)" : "Play loop (Space)"}
          aria-label={props.playing ? "Stop loop" : "Play loop"}
        >
          {props.playing ? (
            <IconPlayerStopFilled size={17} />
          ) : (
            <IconPlayerPlayFilled size={17} />
          )}
          <span>{props.playing ? "STOP" : "PLAY"}</span>
          <kbd>SPACE</kbd>
        </button>

        <div className="jam-transport__divider" aria-hidden="true" />

        <div className="jam-transport-control jam-bpm-control">
          <label className="jam-label" htmlFor="jam-bpm">
            TEMPO
          </label>
          <div className="jam-bpm-control__body">
            <button
              className="jam-icon-button"
              type="button"
              title="Decrease tempo"
              aria-label="Decrease tempo"
              onClick={() => commitBpm(String(props.bpm - 1))}
            >
              <IconMinus size={14} />
            </button>
            <input
              id="jam-bpm"
              className="jam-input jam-mono jam-bpm-input"
              inputMode="numeric"
              value={bpmDraft}
              onChange={(event) => setBpmDraft(event.target.value)}
              onBlur={(event) => commitBpm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  (event.target as HTMLInputElement).blur();
              }}
              aria-label="Tempo in beats per minute"
            />
            <span className="jam-bpm-suffix">BPM</span>
            <button
              className="jam-icon-button"
              type="button"
              title="Increase tempo"
              aria-label="Increase tempo"
              onClick={() => commitBpm(String(props.bpm + 1))}
            >
              <IconPlus size={14} />
            </button>
          </div>
        </div>

        <div className="jam-transport-control jam-key-control">
          <span className="jam-label">KEY</span>
          <div className="jam-key-control__body">
            <select
              className="jam-input jam-key-select"
              value={props.root}
              onChange={(event) => props.onChange({ root: event.target.value })}
              aria-label="Root note"
            >
              {ROOTS.map((root) => (
                <option key={root} value={root}>
                  {root}
                </option>
              ))}
            </select>
            <select
              className="jam-input jam-key-select jam-key-select--scale"
              value={props.scale}
              onChange={(event) =>
                props.onChange({ scale: event.target.value })
              }
              aria-label="Scale"
            >
              {SCALES.map((scale) => (
                <option key={scale} value={scale}>
                  {scale}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="jam-transport-control jam-swing-control">
          <label className="jam-label" htmlFor="jam-swing">
            SWING <strong>{Math.round(props.swing * 100)}%</strong>
          </label>
          <input
            id="jam-swing"
            className="jam-range"
            type="range"
            min={0}
            max={100}
            value={Math.round(props.swing * 100)}
            onChange={(event) =>
              props.onChange({ swing: Number(event.target.value) / 100 })
            }
            aria-label="Swing amount"
          />
        </div>

        <div className="jam-transport__spacer" />
        <button
          className="jam-unstick-button"
          type="button"
          onClick={props.onUnstick}
        >
          <IconBolt size={16} />
          <span>UNSTICK ME</span>
        </button>
        {props.notice ? (
          <span className="jam-transport__notice" role="status">
            {props.notice}
          </span>
        ) : null}
      </div>
      {props.sessionId ? (
        <ControlsStrip sessionId={props.sessionId} energy={props.hatEnergy} />
      ) : null}
    </div>
  );
}
