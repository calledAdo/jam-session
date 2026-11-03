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

const ROW_H = 38;
const ROW_PITCH = 44;
const HEADER_H = 24;
const ROW_LABELS: Record<TrackKind, string> = {
  kick: "KICK",
  snare: "SNARE",
  hat: "HAT",
  bass: "BASS",
  keys: "KEYS",
};

export type SelectionAction = "vary" | "fill" | "simplify" | "darker" | "brighter";

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
}: {
  kind: TrackKind;
  row: number;
  index: number;
  value: StepValue | undefined;
  alt: boolean;
  flash: boolean;
  ghost: boolean;
}) {
  const on = typeof value === "number" && value > 0;
  return (
    <span
      className="jam-cell jam-mono"
      data-cell
      data-row={row}
      data-index={index}
      data-on={on && !ghost ? "true" : undefined}
      data-v={on && kind !== "bass" ? String(value) : undefined}
      data-alt={alt ? "true" : undefined}
      data-flash={flash ? "true" : undefined}
      data-ghost={ghost ? "true" : undefined}
      data-removed={ghost && !on ? "true" : undefined}
      title={`${ROW_LABELS[kind]} step ${index + 1}`}
    >
      {kind === "bass" && on ? value : null}
    </span>
  );
});

const StepRow = memo(function StepRow({
  kind,
  row,
  steps,
  bars,
  flashing,
  ghosts,
}: {
  kind: TrackKind;
  row: number;
  steps: StepValue[];
  bars: number;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
}) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const groups = [];
    for (let g = 0; g < 4; g++) {
      const cells = [];
      for (let c = 0; c < 4; c++) {
        const index = bar * STEPS_PER_BAR + g * 4 + c;
        const key = `${kind}:${index}`;
        cells.push(
          <Cell
            key={index}
            kind={kind}
            row={row}
            index={index}
            value={steps[index]}
            alt={g % 2 === 1}
            flash={flashing.has(key)}
            ghost={ghosts.has(key)}
          />,
        );
      }
      groups.push(
        <span className="jam-group" key={g}>
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
      style={{ position: "absolute", top: rowTop(row), height: ROW_H, left: 0 }}
    >
      {out}
    </div>
  );
});

const KeysRow = memo(function KeysRow({
  row,
  steps,
  bars,
  flashing,
  ghosts,
}: {
  row: number;
  steps: StepValue[];
  bars: number;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
}) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const value = steps[bar];
    const key = `keys:${bar}`;
    out.push(
      <span className="jam-bar" key={bar}>
        <span
          className="jam-chip jam-mono"
          data-cell
          data-row={row}
          data-index={bar}
          data-on={typeof value === "string" ? "true" : undefined}
          data-flash={flashing.has(key) ? "true" : undefined}
          data-ghost={ghosts.has(key) ? "true" : undefined}
          title={`Chord, bar ${bar + 1}`}
        >
          {typeof value === "string" ? value : "+"}
        </span>
      </span>,
    );
  }
  return (
    <div
      style={{ position: "absolute", top: rowTop(row), height: ROW_H, left: 0 }}
    >
      {out}
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
    if (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - BAR_PITCH) {
      scroller.scrollTo({ left: Math.max(0, x - 8), behavior: "smooth" });
    }
  }, [step, scrollerRef, follow]);
  if (step < 0) return null;
  return (
    <div
      className="jam-playhead"
      style={{
        left: stepX(step),
        height: 5 * ROW_PITCH - 6,
        width: CELL_W,
      }}
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
  const [picker, setPicker] = useState<number | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const trackByKind = (kind: TrackKind) => tracks.find((t) => t.kind === kind);

  // Bass scroll-wheel: needs a non-passive listener to stop page scrolling.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let acc = 0;
    const onWheel = (event: WheelEvent) => {
      const cell = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
        "[data-cell]",
      );
      if (!cell || cell.dataset.row !== "3") return;
      event.preventDefault();
      acc += event.deltaY;
      if (Math.abs(acc) < 40) return;
      const delta = acc < 0 ? 1 : -1; // wheel up = higher degree
      acc = 0;
      latest.current.onBassWheel(Number(cell.dataset.index), delta);
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, []);

  const cellFromEvent = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(
      "[data-cell]",
    );
    if (!el) return null;
    const row = Number(el.dataset.row);
    const index = Number(el.dataset.index);
    const bar = row === 4 ? index : Math.floor(index / STEPS_PER_BAR);
    return { row, index, bar, rect: el.getBoundingClientRect() };
  };

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("[data-overlay]")) return;
      const start = cellFromEvent(event.target);
      setPicker(null);
      if (!start) {
        onSelect(null);
        return;
      }
      const shift = event.shiftKey;
      let moved = false;
      const move = (e: PointerEvent) => {
        const cur = cellFromEvent(document.elementFromPoint(e.clientX, e.clientY));
        if (!cur) return;
        if (!moved && (cur.row !== start.row || cur.bar !== start.bar)) {
          moved = true;
        }
        if (moved) {
          latest.current.onSelect(selectionFromCorners(start, cur));
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (moved) return;
        latest.current.onSelect(null);
        const p = latest.current;
        if (start.row <= 2) {
          p.onDrumClick(TRACK_ORDER[start.row]!, start.index, shift);
        } else if (start.row === 3) {
          p.onBassClick(start.index);
        } else {
          setPicker(start.bar);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onSelect],
  );

  const bodyWidth = bars * BAR_PITCH;
  const bodyHeight = HEADER_H + 5 * ROW_PITCH + 70;

  const rect = selection
    ? (() => {
        const first = TRACK_ORDER.indexOf(selection.tracks[0]!);
        const n = selection.tracks.length;
        return {
          left: selection.barStart * BAR_PITCH - 5,
          top: rowTop(first) - 4,
          width: (selection.barEnd - selection.barStart + 1) * BAR_PITCH - 2,
          height: n * ROW_PITCH - 2,
        };
      })()
    : null;

  const choices = numeralChoices(props.scale);

  return (
    <div className="flex">
      <div className="shrink-0" style={{ width: 70 }}>
        {TRACK_ORDER.map((kind, row) => (
          <div
            key={kind}
            className="jam-mono jam-label"
            style={{
              position: "relative",
              top: rowTop(row) - (row === 0 ? 0 : 0),
              height: 0,
              lineHeight: `${ROW_H}px`,
              paddingLeft: 4,
            }}
          >
            {ROW_LABELS[kind]}
          </div>
        ))}
      </div>
      <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div
          ref={bodyRef}
          className="relative"
          style={{ width: bodyWidth, height: bodyHeight }}
          onPointerDown={onPointerDown}
        >
          {Array.from({ length: bars }, (_, bar) => (
            <div
              key={bar}
              className="jam-mono jam-label"
              style={{
                position: "absolute",
                left: bar * BAR_PITCH,
                top: 0,
                width: BAR_PITCH - 10,
                height: HEADER_H - 4,
                borderBottom: "1px solid var(--jam-line)",
                paddingLeft: 4,
                lineHeight: `${HEADER_H - 4}px`,
              }}
            >
              {bar + 1}
            </div>
          ))}
          {(["kick", "snare", "hat", "bass"] as const).map((kind, row) => (
            <StepRow
              key={kind}
              kind={kind}
              row={row}
              steps={trackByKind(kind)?.steps ?? []}
              bars={bars}
              flashing={props.flashing}
              ghosts={props.ghosts}
            />
          ))}
          <KeysRow
            row={4}
            steps={trackByKind("keys")?.steps ?? []}
            bars={bars}
            flashing={props.flashing}
            ghosts={props.ghosts}
          />
          <Playhead scrollerRef={scrollerRef} follow={!selection && picker === null} />
          {rect ? <div className="jam-select-rect" style={rect} /> : null}
          {rect && selection ? (
            <div
              data-overlay
              className="jam-menu"
              style={{ left: Math.max(0, rect.left), top: rect.top + rect.height + 8 }}
            >
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
                  className="jam-btn"
                  disabled={props.menuBusy}
                  onClick={() => props.onMenuAction(action)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="jam-btn jam-btn-amber"
                onClick={props.onAskBandmate}
              >
                Ask bandmate
              </button>
            </div>
          ) : null}
          {picker !== null ? (
            <div
              data-overlay
              className="jam-picker"
              style={{
                left: Math.min(picker * BAR_PITCH, Math.max(0, bodyWidth - 280)),
                top: rowTop(4) + ROW_H + 6,
              }}
            >
              {choices.map((numeral) => (
                <button
                  key={numeral}
                  type="button"
                  className="jam-btn jam-mono"
                  onClick={() => {
                    props.onPickChord(picker, numeral);
                    setPicker(null);
                  }}
                >
                  {numeral}
                </button>
              ))}
              <button
                type="button"
                className="jam-btn jam-mono"
                onClick={() => {
                  props.onPickChord(picker, null);
                  setPicker(null);
                }}
              >
                off
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
