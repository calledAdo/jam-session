import {
  IconMessageCircle,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconAdjustments,
} from "@tabler/icons-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

import "./jam.css";

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
  soundOpen: boolean;
  onSoundOpen: (open: boolean) => void;
  onAskBand: () => void;
  ideaCount: number;
  hasNewIdeas: boolean;
};

export function SoundControls({
  bpm,
  root,
  scale,
  swing,
  onChange,
}: Pick<TransportBarProps, "bpm" | "root" | "scale" | "swing" | "onChange">) {
  return (
    <div className="jam-sound-controls">
      <label className="jam-sound-field">
        Speed <small>· {bpm}</small>
        <input
          aria-label="Speed"
          className="jam-range"
          type="range"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => onChange({ bpm: Number(e.target.value) })}
        />
        <span className="jam-range-labels">
          <span>Slower</span>
          <span>Faster</span>
        </span>
      </label>
      <fieldset className="jam-mood">
        <legend>Mood</legend>
        <div>
          <button
            type="button"
            aria-pressed={scale !== "major"}
            onClick={() => onChange({ scale: "minor" })}
          >
            Sad
          </button>
          <button
            type="button"
            aria-pressed={scale === "major"}
            onClick={() => onChange({ scale: "major" })}
          >
            Happy
          </button>
        </div>
      </fieldset>
      <label className="jam-sound-field">
        Bounce <small>· {Math.round(swing * 100)}%</small>
        <input
          aria-label="Bounce"
          className="jam-range"
          type="range"
          min={0}
          max={100}
          value={Math.round(swing * 100)}
          onChange={(e) => onChange({ swing: Number(e.target.value) / 100 })}
        />
      </label>
      <details className="jam-sound-more">
        <summary>More</summary>
        <label>
          Root note{" "}
          <select
            aria-label="Root note"
            className="jam-input"
            value={root}
            onChange={(e) => onChange({ root: e.target.value })}
          >
            {[
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
            ].map((note) => (
              <option key={note}>{note}</option>
            ))}
          </select>
        </label>
      </details>
    </div>
  );
}

export function TransportBar(props: TransportBarProps) {
  return (
    <>
      <div className="jam-dock" role="group" aria-label="Sketch controls">
        <button
          type="button"
          className="jam-dock__side"
          onClick={() => props.onSoundOpen(true)}
        >
          <IconAdjustments size={21} />
          Sound
        </button>
        <button
          type="button"
          className="jam-play-button"
          data-playing={props.playing}
          onClick={props.onTogglePlay}
          aria-label={props.playing ? "Stop" : "Play"}
        >
          {props.playing ? (
            <IconPlayerStopFilled size={24} />
          ) : (
            <IconPlayerPlayFilled size={24} />
          )}
          <span>{props.playing ? "Stop" : "Play"}</span>
        </button>
        <button
          type="button"
          className="jam-dock__side jam-dock__band"
          onClick={props.onAskBand}
        >
          <span className="jam-dock__badge-wrap">
            <IconMessageCircle size={21} />
            {props.ideaCount > 0 && (
              <b
                className="jam-idea-badge"
                data-new={props.hasNewIdeas || undefined}
              >
                {props.ideaCount}
              </b>
            )}
          </span>
          Ask the band
        </button>
      </div>
      <Sheet open={props.soundOpen} onOpenChange={props.onSoundOpen}>
        <SheetContent
          side="bottom"
          className="jam-root jam-bottom-sheet jam-sound-sheet"
        >
          <SheetTitle>Sound</SheetTitle>
          <SheetDescription className="sr-only">
            Shape the feel of your sketch.
          </SheetDescription>
          <SoundControls {...props} />
        </SheetContent>
      </Sheet>
    </>
  );
}
