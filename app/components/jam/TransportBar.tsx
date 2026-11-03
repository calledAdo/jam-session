import { IconPlayerPlayFilled, IconPlayerStopFilled, IconBolt } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import "./jam.css";

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = ["major", "minor", "dorian", "pentatonic minor"];

export type TransportBarProps = {
  name: string;
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
    <div className="jam-panel flex flex-wrap items-end gap-4 px-4 py-3">
      <button
        type="button"
        className="jam-btn jam-btn-play"
        data-playing={props.playing ? "true" : "false"}
        onClick={props.onTogglePlay}
        style={{ width: 84, height: 44, justifyContent: "center", fontSize: 14 }}
        title="Space"
      >
        {props.playing ? (
          <IconPlayerStopFilled size={18} />
        ) : (
          <IconPlayerPlayFilled size={18} />
        )}
        {props.playing ? "Stop" : "Play"}
      </button>

      <label className="flex flex-col gap-1">
        <span className="jam-label">BPM</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="jam-btn"
            style={{ width: 30, padding: 0, justifyContent: "center" }}
            onClick={() => commitBpm(String(props.bpm - 1))}
          >
            -
          </button>
          <input
            className="jam-input jam-mono"
            style={{ width: 60, textAlign: "center" }}
            inputMode="numeric"
            value={bpmDraft}
            onChange={(e) => setBpmDraft(e.target.value)}
            onBlur={(e) => commitBpm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <button
            type="button"
            className="jam-btn"
            style={{ width: 30, padding: 0, justifyContent: "center" }}
            onClick={() => commitBpm(String(props.bpm + 1))}
          >
            +
          </button>
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="jam-label">Key</span>
        <span className="flex gap-1">
          <select
            className="jam-input"
            value={props.root}
            onChange={(e) => props.onChange({ root: e.target.value })}
          >
            {ROOTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="jam-input"
            value={props.scale}
            onChange={(e) => props.onChange({ scale: e.target.value })}
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="jam-label">Swing {Math.round(props.swing * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(props.swing * 100)}
          onChange={(e) => props.onChange({ swing: Number(e.target.value) / 100 })}
          style={{ width: 120, accentColor: "var(--jam-cyan)", height: 34 }}
        />
      </label>

      <button
        type="button"
        className="jam-btn jam-btn-amber"
        style={{ height: 44 }}
        onClick={props.onUnstick}
      >
        <IconBolt size={16} />
        Unstick me
      </button>

      <div className="ml-auto flex flex-col items-end gap-1">
        <span className="jam-label">Session</span>
        <span className="text-sm font-semibold">{props.name}</span>
        {props.notice ? (
          <span className="jam-mono text-xs" style={{ color: "var(--jam-amber)" }}>
            {props.notice}
          </span>
        ) : null}
      </div>
    </div>
  );
}
