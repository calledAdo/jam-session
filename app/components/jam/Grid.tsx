import { IconArrowUpRight, IconMinus, IconPlus } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { getJamEngine } from "@/lib/jam/audio";
import {
  BAR_PITCH,
  CELL_W,
  STEPS_PER_BAR,
  TRACK_ORDER,
  numeralChoices,
  selectionFromCorners,
  stepX,
  type Selection,
  type StepValue,
  type TrackData,
  type TrackKind,
} from "@/lib/jam/grid";

import "./jam.css";

const ROW_H = 32;
const ROW_PITCH = 44;
const HEADER_H = 34;
const ROW_LABELS: Record<TrackKind, string> = {
  kick: "KICK",
  snare: "SNARE",
  hat: "HAT",
  bass: "BASS",
  keys: "KEYS",
};

export type SelectionAction =
  | "vary"
  | "fill"
  | "simplify"
  | "darker"
  | "brighter";

function rowTop(row: number): number {
  return HEADER_H + row * ROW_PITCH;
}

const Cell = memo(function Cell({
  kind,
  row,
  index,
  value,
  alt,
  flash,
  ghost,
  onFocus,
}: {
  kind: TrackKind;
  row: number;
  index: number;
  value: StepValue | undefined;
  alt: boolean;
  flash: boolean;
  ghost: boolean;
  onFocus?: () => void;
}) {
  const on = typeof value === "number" && value > 0;
  const label =
    kind === "bass"
      ? `${ROW_LABELS[kind]} step ${index + 1}, ${on ? `scale degree ${value}` : "off"}`
      : `${ROW_LABELS[kind]} step ${index + 1}, ${on ? "on" : "off"}`;

  return (
    <button
      type="button"
      className="jam-cell jam-mono"
      data-cell
      data-row={row}
      data-index={index}
      data-kind={kind}
      data-on={on && !ghost ? "true" : undefined}
      data-v={on && kind !== "bass" ? String(value) : undefined}
      data-alt={alt ? "true" : undefined}
      data-flash={flash ? "true" : undefined}
      data-ghost={ghost ? "true" : undefined}
      data-removed={ghost && !on ? "true" : undefined}
      title={`${label}${kind === "bass" ? " · use the visible degree stepper, or scroll to transpose" : " · Shift-click changes velocity"}`}
      aria-label={label}
      aria-pressed={on}
      onFocus={onFocus}
      onPointerEnter={onFocus}
    >
      {kind === "bass" && on ? value : null}
    </button>
  );
});

const StepRow = memo(function StepRow({
  kind,
  row,
  steps,
  bars,
  flashing,
  ghosts,
  onFocusCell,
}: {
  kind: TrackKind;
  row: number;
  steps: StepValue[];
  bars: number;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
  onFocusCell?: (index: number) => void;
}) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const groups = [];
    for (let group = 0; group < 4; group++) {
      const cells = [];
      for (let cell = 0; cell < 4; cell++) {
        const index = bar * STEPS_PER_BAR + group * 4 + cell;
        const key = `${kind}:${index}`;
        cells.push(
          <Cell
            key={index}
            kind={kind}
            row={row}
            index={index}
            value={steps[index]}
            alt={group % 2 === 1}
            flash={flashing.has(key)}
            ghost={ghosts.has(key)}
            {...(kind === "bass" && onFocusCell
              ? { onFocus: () => onFocusCell(index) }
              : {})}
          />,
        );
      }
      groups.push(
        <span className="jam-step-group" key={group}>
          {cells}
        </span>,
      );
    }
    out.push(
      <span className="jam-bar" key={bar}>
        {groups}
      </span>,
    );
  }
  return (
    <div
      className="jam-grid-row"
      data-track-row={kind}
      style={{ top: rowTop(row), height: ROW_H }}
    >
      {out}
    </div>
  );
});

const KeysRow = memo(function KeysRow({
  steps,
  bars,
  flashing,
  ghosts,
  choices,
  onPickChord,
}: {
  steps: StepValue[];
  bars: number;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
  choices: string[];
  onPickChord: (bar: number, numeral: string | null) => void;
}) {
  return (
    <div
      className="jam-grid-row jam-grid-row--keys"
      data-track-row="keys"
      style={{ top: rowTop(4), height: ROW_H }}
    >
      {Array.from({ length: bars }, (_, bar) => {
        const value = steps[bar];
        const key = `keys:${bar}`;
        return (
          <span className="jam-bar" key={bar}>
            <select
              className="jam-chord-select jam-mono"
              data-cell
              data-direct-control
              data-row="4"
              data-index={bar}
              data-ghost={ghosts.has(key) ? "true" : undefined}
              data-flash={flashing.has(key) ? "true" : undefined}
              data-on={typeof value === "string" ? "true" : undefined}
              title={`Change chord for bar ${bar + 1}`}
              aria-label={`Chord for bar ${bar + 1}: ${typeof value === "string" ? value : "off"}`}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onPickChord(bar, event.target.value || null)}
            >
              <option value="">Off</option>
              {choices.map((numeral) => (
                <option key={numeral} value={numeral}>
                  {numeral}
                </option>
              ))}
            </select>
          </span>
        );
      })}
    </div>
  );
});

function Playhead({
  scrollerRef,
  follow,
}: {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  follow: boolean;
}) {
  const [step, setStep] = useState(-1);
  useEffect(() => getJamEngine().onStep(setStep), []);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!follow || !scroller || step < 0 || step % STEPS_PER_BAR !== 0) return;
    const x = stepX(step);
    if (
      x < scroller.scrollLeft ||
      x > scroller.scrollLeft + scroller.clientWidth - BAR_PITCH
    ) {
      scroller.scrollTo({ left: Math.max(0, x - 8), behavior: "smooth" });
    }
  }, [step, scrollerRef, follow]);
  if (step < 0) return null;
  return (
    <div
      className="jam-playhead"
      style={{ left: stepX(step), height: 5 * ROW_PITCH, width: CELL_W }}
      aria-hidden="true"
    />
  );
}

export type GridProps = {
  tracks: TrackData[];
  bars: number;
  scale: string;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onDrumClick: (kind: TrackKind, index: number, shift: boolean) => void;
  onBassClick: (index: number) => void;
  onBassWheel: (index: number, delta: number) => void;
  onPickChord: (bar: number, numeral: string | null) => void;
  onMenuAction: (action: SelectionAction) => void;
  onAskBandmate: () => void;
  menuBusy: boolean;
};

export function Grid(props: GridProps) {
  const { tracks, bars, selection, onSelect } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef(props);
  const [bassIndex, setBassIndex] = useState(0);
  latest.current = props;

  const trackByKind = (kind: TrackKind) =>
    tracks.find((track) => track.kind === kind);
  const bassValue = trackByKind("bass")?.steps[bassIndex];
  const bassDegree =
    typeof bassValue === "number" && bassValue > 0 ? bassValue : "-";

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let accumulator = 0;
    const onWheel = (event: WheelEvent) => {
      const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-cell]",
      );
      if (
        !cell ||
        cell.dataset.row !== "3" ||
        cell.dataset.directControl !== undefined
      )
        return;
      event.preventDefault();
      accumulator += event.deltaY;
      if (Math.abs(accumulator) < 40) return;
      const delta = accumulator < 0 ? 1 : -1;
      accumulator = 0;
      const index = Number(cell.dataset.index);
      setBassIndex(index);
      latest.current.onBassWheel(index, delta);
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, []);

  const cellFromEvent = (target: EventTarget | null) => {
    const element = (target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-cell]",
    );
    if (!element) return null;
    const row = Number(element.dataset.row);
    const index = Number(element.dataset.index);
    const bar = row === 4 ? index : Math.floor(index / STEPS_PER_BAR);
    return { row, index, bar };
  };

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "[data-overlay], [data-bar-header], [data-direct-control]",
        )
      )
        return;
      const start = cellFromEvent(target);
      if (!start) {
        onSelect(null);
        return;
      }

      const optionDrag = event.altKey;
      let moved = false;
      const move = (pointerEvent: PointerEvent) => {
        const current = cellFromEvent(
          document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY),
        );
        if (!current) return;
        if (current.row !== start.row || current.bar !== start.bar)
          moved = true;
        if (moved) {
          latest.current.onSelect(
            optionDrag
              ? {
                  tracks: [...TRACK_ORDER],
                  barStart: start.bar,
                  barEnd: start.bar,
                }
              : selectionFromCorners(start, current),
          );
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (moved) return;
        const current = latest.current;
        current.onSelect(null);
        if (start.row <= 2) {
          current.onDrumClick(
            TRACK_ORDER[start.row]!,
            start.index,
            event.shiftKey,
          );
        } else if (start.row === 3) {
          setBassIndex(start.index);
          current.onBassClick(start.index);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onSelect],
  );

  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-direct-control]")) return;
    const cell = cellFromEvent(target);
    if (!cell) return;
    event.preventDefault();
    latest.current.onSelect(null);
    if (cell.row <= 2) {
      latest.current.onDrumClick(
        TRACK_ORDER[cell.row]!,
        cell.index,
        event.shiftKey,
      );
    } else if (cell.row === 3) {
      setBassIndex(cell.index);
      latest.current.onBassClick(cell.index);
    }
  };

  const bodyWidth = bars * BAR_PITCH;
  const bodyHeight = HEADER_H + 5 * ROW_PITCH;
  const rect = selection
    ? (() => {
        const firstRow = TRACK_ORDER.indexOf(selection.tracks[0]!);
        return {
          left: selection.barStart * BAR_PITCH - 3,
          top: rowTop(firstRow) - 4,
          width: (selection.barEnd - selection.barStart + 1) * BAR_PITCH - 4,
          height: selection.tracks.length * ROW_PITCH - 2,
        };
      })()
    : null;
  const choices = numeralChoices(props.scale);
  const selectedBars = selection
    ? selection.barStart === selection.barEnd
      ? `BAR ${selection.barStart + 1}`
      : `BARS ${selection.barStart + 1}–${selection.barEnd + 1}`
    : null;

  return (
    <div className="jam-grid-shell">
      {selection ? (
        <div
          className="jam-selection-tools"
          role="group"
          aria-label="Actions for selected bars"
          data-overlay
        >
          <span className="jam-selection-tools__label">
            <strong>{selectedBars}</strong>
            <span>
              {selection.tracks.map((track) => ROW_LABELS[track]).join(" · ")}
            </span>
          </span>
          {(
            [
              ["vary", "Vary"],
              ["fill", "Fill"],
              ["simplify", "Simplify"],
              ["darker", "Darker"],
              ["brighter", "Brighter"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              className="jam-tool-button"
              disabled={props.menuBusy}
              onClick={() => props.onMenuAction(action)}
            >
              {label}
            </button>
          ))}
          <button
            className="jam-tool-button jam-tool-button--agent"
            type="button"
            onClick={props.onAskBandmate}
          >
            Ask bandmate <IconArrowUpRight size={13} />
          </button>
        </div>
      ) : null}

      <div className="jam-grid-layout">
        <div
          className="jam-grid-labels"
          role="group"
          aria-label="Track controls"
        >
          {TRACK_ORDER.map((kind, row) => (
            <div
              key={kind}
              className="jam-track-label"
              data-track={kind}
              style={{ top: rowTop(row), height: ROW_H }}
            >
              {kind === "bass" ? (
                <>
                  <span className="jam-track-label__name">BASS</span>
                  <span
                    className="jam-degree-control"
                    role="group"
                    aria-label={`Scale degree for step ${bassIndex + 1}`}
                  >
                    <button
                      className="jam-degree-control__button"
                      type="button"
                      title="Lower selected bass degree"
                      aria-label="Lower selected bass degree"
                      onClick={() => props.onBassWheel(bassIndex, -1)}
                    >
                      <IconMinus size={11} />
                    </button>
                    <span className="jam-degree-control__value jam-mono">
                      {bassDegree}
                    </span>
                    <button
                      className="jam-degree-control__button"
                      type="button"
                      title="Raise selected bass degree"
                      aria-label="Raise selected bass degree"
                      onClick={() => props.onBassWheel(bassIndex, 1)}
                    >
                      <IconPlus size={11} />
                    </button>
                  </span>
                </>
              ) : (
                <span className="jam-track-label__name">
                  {ROW_LABELS[kind]}
                </span>
              )}
            </div>
          ))}
        </div>
        <div
          ref={scrollerRef}
          className="jam-grid-scroll"
          role="region"
          aria-label="16-step loop grid"
        >
          <div
            ref={bodyRef}
            className="jam-grid-body"
            role="group"
            aria-label="Loop steps"
            style={{ width: bodyWidth, height: bodyHeight }}
            onPointerDown={onPointerDown}
            onKeyDown={onGridKeyDown}
          >
            {Array.from({ length: bars }, (_, bar) => {
              const isSelected = Boolean(
                selection &&
                bar >= selection.barStart &&
                bar <= selection.barEnd,
              );
              return (
                <button
                  key={bar}
                  type="button"
                  className="jam-bar-tab jam-mono"
                  data-bar-header
                  data-selected={isSelected ? "true" : undefined}
                  aria-pressed={isSelected}
                  aria-label={`Select bar ${bar + 1} across all tracks`}
                  style={{
                    left: bar * BAR_PITCH,
                    width: BAR_PITCH - 8,
                    height: HEADER_H - 5,
                  }}
                  onClick={(event) => {
                    const current = latest.current.selection;
                    const barStart =
                      event.shiftKey && current
                        ? Math.min(current.barStart, bar)
                        : bar;
                    const barEnd =
                      event.shiftKey && current
                        ? Math.max(current.barEnd, bar)
                        : bar;
                    onSelect({ tracks: [...TRACK_ORDER], barStart, barEnd });
                  }}
                >
                  <span>{String(bar + 1).padStart(2, "0")}</span>
                  <i />
                </button>
              );
            })}
            {(["kick", "snare", "hat", "bass"] as const).map((kind, row) => (
              <StepRow
                key={kind}
                kind={kind}
                row={row}
                steps={trackByKind(kind)?.steps ?? []}
                bars={bars}
                flashing={props.flashing}
                ghosts={props.ghosts}
                {...(kind === "bass" ? { onFocusCell: setBassIndex } : {})}
              />
            ))}
            <KeysRow
              steps={trackByKind("keys")?.steps ?? []}
              bars={bars}
              flashing={props.flashing}
              ghosts={props.ghosts}
              choices={choices}
              onPickChord={props.onPickChord}
            />
            <Playhead scrollerRef={scrollerRef} follow={!selection} />
            {rect ? (
              <div
                className="jam-select-rect"
                style={rect}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="jam-grid-legend">
        <span>
          <i className="jam-legend-dot jam-legend-dot--you" /> YOU
        </span>
        <span>
          <i className="jam-legend-dot jam-legend-dot--agent" /> BANDMATE
        </span>
        <span className="jam-grid-legend__hint">
          Shift-click cycles velocity · Scroll bass to transpose · chord
          selector edits harmony
        </span>
      </div>
    </div>
  );
}
