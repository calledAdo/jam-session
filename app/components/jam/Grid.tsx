import {
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconHandStop,
  IconDisc,
  IconWaveSine,
  IconPiano,
  IconMessageCircle,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { getJamEngine } from "@/lib/jam/audio";
import {
  chordName,
  chordChoices,
  pageBars,
  TRACK_ORDER,
  type BarCommentData,
  type Selection,
  type TrackData,
  type TrackKind,
} from "@/lib/jam/grid";

import { BarCommentPopover } from "./BarComments";

import "./jam.css";

export type SelectionAction =
  | "vary"
  | "fill"
  | "simplify"
  | "darker"
  | "brighter";
export type GridProps = {
  tracks: TrackData[];
  bars: number;
  root: string;
  scale: string;
  flashing: ReadonlySet<string>;
  ghosts: ReadonlySet<string>;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  page: number;
  perPage: number;
  onPage: (page: number) => void;
  ideaBars: ReadonlySet<number>;
  editing: boolean;
  rangeOpen: boolean;
  onRangeOpen: (open: boolean) => void;
  onDrumClick: (kind: TrackKind, index: number, shift: boolean) => void;
  onBassClick: (index: number) => void;
  onBassWheel: (index: number, delta: number) => void;
  onLevelChange: (kind: TrackKind, index: number, delta: number) => void;
  onPickChord: (bar: number, numeral: string | null) => void;
  comments: BarCommentData[];
  onAddComment: (bar: number, text: string) => Promise<void>;
  onSeeIdea: (ideaId: string) => void;
};
const LABELS = {
  kick: "Kick",
  snare: "Clap",
  hat: "Hi-hat",
  bass: "Bass",
  keys: "Chords",
};
const ICONS = {
  kick: IconCircle,
  snare: IconHandStop,
  hat: IconDisc,
  bass: IconWaveSine,
  keys: IconPiano,
};

export function Grid(props: GridProps) {
  const { tracks, bars, page, perPage, selection } = props;
  const [noteBar, setNoteBar] = useState<number | null>(null);
  const [chordBar, setChordBar] = useState<number | null>(null);
  const [soundCell, setSoundCell] = useState<{
    kind: TrackKind;
    index: number;
  } | null>(null);
  const [rangeStart, setRangeStart] = useState(page);
  const [rangeEnd, setRangeEnd] = useState(page);
  const [step, setStep] = useState(-1);
  const press = useRef<{
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | null;
    held: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const visible = pageBars(page, bars, perPage);
  const track = (kind: TrackKind) => tracks.find((t) => t.kind === kind);
  const hasSound = (bar: number) =>
    tracks.some((t) =>
      (t.kind === "keys"
        ? t.steps.slice(bar, bar + 1)
        : t.steps.slice(bar * 16, (bar + 1) * 16)
      ).some((v) => typeof v === "string" || (typeof v === "number" && v > 0)),
    );
  useEffect(() => getJamEngine().onStep(setStep), []);
  useEffect(
    () => () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
    },
    [],
  );
  useEffect(() => {
    if (props.rangeOpen) {
      setRangeStart(selection?.barStart ?? page);
      setRangeEnd(selection?.barEnd ?? page);
    }
  }, [props.rangeOpen]);

  const beginPress = (event: React.PointerEvent, held: () => void) => {
    if (event.button !== 0) return;
    suppressClick.current = false;
    const current = {
      x: event.clientX,
      y: event.clientY,
      timer: null as ReturnType<typeof setTimeout> | null,
      held: false,
    };
    current.timer = setTimeout(() => {
      current.held = true;
      suppressClick.current = true;
      held();
    }, 500);
    press.current = current;
  };
  const endPress = (event: React.PointerEvent, swipe = false) => {
    const current = press.current;
    if (!current) return;
    if (current.timer) clearTimeout(current.timer);
    const dx = event.clientX - current.x;
    if (
      swipe &&
      !current.held &&
      Math.abs(dx) > 40 &&
      Math.abs(dx) > Math.abs(event.clientY - current.y)
    ) {
      suppressClick.current = true;
      props.onPage(
        Math.max(
          0,
          Math.min(
            bars - 1,
            page + (dx < 0 ? visible.length : -visible.length),
          ),
        ),
      );
    }
    press.current = null;
  };
  const cancelPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
    suppressClick.current = true;
  };
  const openRange = (bar: number) => {
    props.onPage(bar);
    setRangeStart(bar);
    setRangeEnd(bar);
    props.onRangeOpen(true);
  };
  const options = chordChoices(props.root, props.scale);

  return (
    <div className="jam-sketch-grid">
      <div className="jam-pager">
        <div className="jam-pager__main">
          <button
            type="button"
            className="jam-icon-button"
            aria-label="Previous bar"
            disabled={page === 0}
            onClick={() =>
              props.onPage(Math.max(0, page - (perPage === bars ? 1 : perPage)))
            }
          >
            <IconChevronLeft size={20} />
          </button>
          <span aria-live="polite">
            Bar <strong>{page + 1}</strong> of {bars}
          </span>
          <button
            type="button"
            className="jam-icon-button"
            aria-label="Next bar"
            disabled={page >= bars - 1}
            onClick={() =>
              props.onPage(
                Math.min(bars - 1, page + (perPage === bars ? 1 : perPage)),
              )
            }
          >
            <IconChevronRight size={20} />
          </button>
          <button
            type="button"
            className="jam-icon-button jam-pager__note"
            aria-label="Note on this bar"
            onClick={() => setNoteBar(page)}
          >
            <IconMessageCircle size={20} />
            {props.comments.some((c) => c.bar === page) && <i />}
          </button>
        </div>
        <div className="jam-bar-dots" aria-label="Choose a bar">
          {Array.from({ length: bars }, (_, bar) => (
            <button
              key={bar}
              type="button"
              aria-label={`Bar ${bar + 1}${hasSound(bar) ? ", has sound" : ", empty"}${props.ideaBars.has(bar) ? ", band idea" : ""}`}
              aria-pressed={
                !!selection &&
                bar >= selection.barStart &&
                bar <= selection.barEnd
              }
              className="jam-bar-dot"
              data-current={bar === page || undefined}
              data-sound={hasSound(bar) || undefined}
              data-idea={props.ideaBars.has(bar) || undefined}
              onPointerDown={(e) => beginPress(e, () => openRange(bar))}
              onPointerMove={(e) => {
                if (
                  press.current &&
                  Math.hypot(
                    e.clientX - press.current.x,
                    e.clientY - press.current.y,
                  ) > 10
                )
                  cancelPress();
              }}
              onPointerUp={(e) => endPress(e)}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                openRange(bar);
              }}
              onClick={() => {
                if (!suppressClick.current) props.onPage(bar);
              }}
            >
              <i />
            </button>
          ))}
        </div>
        {selection && selection.barStart !== selection.barEnd && (
          <button
            type="button"
            className="jam-range-summary"
            onClick={() => props.onRangeOpen(true)}
          >
            Bars {selection.barStart + 1}–{selection.barEnd + 1} selected
          </button>
        )}
      </div>
      <div className="jam-grid-group-label">Drums</div>
      <div
        className="jam-page-grid"
        style={{ "--visible-bars": visible.length } as React.CSSProperties}
        role="group"
        aria-label="Sketch squares"
        onPointerUp={(e) => endPress(e, true)}
        onPointerCancel={cancelPress}
        onPointerMove={(e) => {
          const current = press.current;
          if (
            current &&
            Math.hypot(e.clientX - current.x, e.clientY - current.y) > 10 &&
            current.timer
          ) {
            clearTimeout(current.timer);
            current.timer = null;
            suppressClick.current = true;
          }
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        <div className="jam-page-grid__headers">
          <span />
          {visible.map((bar) => (
            <button
              key={bar}
              type="button"
              aria-label={`Select bar ${bar + 1}`}
              aria-pressed={
                !!selection &&
                bar >= selection.barStart &&
                bar <= selection.barEnd
              }
              onClick={(e) => {
                if (e.shiftKey && selection)
                  props.onSelect({
                    tracks: [...TRACK_ORDER],
                    barStart: Math.min(selection.barStart, bar),
                    barEnd: Math.max(selection.barEnd, bar),
                  });
                else props.onPage(bar);
              }}
            >
              Bar {bar + 1}
            </button>
          ))}
        </div>
        {TRACK_ORDER.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <div className="jam-page-row" key={kind} data-track-row={kind}>
              <span
                className="jam-page-label"
                title={LABELS[kind]}
                tabIndex={0}
                aria-label={LABELS[kind]}
              >
                <Icon size={18} />
                <span>{LABELS[kind]}</span>
              </span>
              {visible.map((bar) =>
                kind === "keys" ? (
                  <button
                    type="button"
                    key={bar}
                    className="jam-chord-chip"
                    data-cell
                    data-kind="keys"
                    data-index={bar}
                    data-ghost={props.ghosts.has(`keys:${bar}`) || undefined}
                    data-flash={props.flashing.has(`keys:${bar}`) || undefined}
                    disabled={props.editing && !props.ghosts.has(`keys:${bar}`)}
                    aria-label={`Chord for bar ${bar + 1}`}
                    onClick={() => setChordBar(bar)}
                  >
                    {typeof track(kind)?.steps[bar] === "string"
                      ? chordName(
                          props.root,
                          props.scale,
                          track(kind)!.steps[bar] as string,
                        )
                      : "+ Chord"}
                  </button>
                ) : (
                  <div key={bar} className="jam-page-bar">
                    {Array.from({ length: 4 }, (_, group) => (
                      <div className="jam-page-beat" key={group}>
                        {Array.from({ length: 4 }, (_, cell) => {
                          const index = bar * 16 + group * 4 + cell;
                          const value = track(kind)?.steps[index];
                          const on = typeof value === "number" && value > 0;
                          const key = `${kind}:${index}`;
                          return (
                            <button
                              key={index}
                              type="button"
                              className="jam-cell"
                              data-cell
                              data-kind={kind}
                              data-index={index}
                              data-on={on || undefined}
                              data-v={on ? value : undefined}
                              data-ghost={props.ghosts.has(key) || undefined}
                              data-flash={props.flashing.has(key) || undefined}
                              data-playhead={step === index || undefined}
                              disabled={props.editing && !props.ghosts.has(key)}
                              aria-label={`${LABELS[kind]} bar ${bar + 1} square ${group * 4 + cell + 1}, ${on ? "on" : "off"}`}
                              aria-pressed={on}
                              onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                beginPress(e, () =>
                                  setSoundCell({ kind, index }),
                                );
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setSoundCell({ kind, index });
                              }}
                              onClick={(e) =>
                                kind === "bass"
                                  ? props.onBassClick(index)
                                  : props.onDrumClick(kind, index, e.shiftKey)
                              }
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          );
        })}
      </div>
      <div className="jam-grid-legend">
        <span>
          <i className="jam-legend-dot jam-legend-dot--you" />
          You
        </span>
        <span>
          <i className="jam-legend-dot jam-legend-dot--agent" />
          The band
        </span>
        <span className="jam-grid-legend__hint">
          Hold a square to shape its sound
        </span>
      </div>
      <Sheet
        open={chordBar !== null}
        onOpenChange={(open) => {
          if (!open) setChordBar(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="jam-root jam-bottom-sheet jam-chord-sheet"
        >
          <SheetTitle>Choose a chord</SheetTitle>
          <SheetDescription>For bar {(chordBar ?? 0) + 1}</SheetDescription>
          {["Sad", "Bright", "Tense"].map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              <div className="jam-chord-options">
                {options
                  .filter((o) => o.group === group)
                  .map((option) => (
                    <button
                      type="button"
                      className="jam-btn"
                      key={option.numeral}
                      aria-pressed={
                        track("keys")?.steps[chordBar ?? 0] === option.numeral
                      }
                      onClick={() => {
                        if (chordBar !== null)
                          props.onPickChord(chordBar, option.numeral);
                        setChordBar(null);
                      }}
                    >
                      {option.name}
                    </button>
                  ))}
              </div>
            </section>
          ))}
          <button
            type="button"
            className="jam-text-button"
            onClick={() => {
              if (chordBar !== null) props.onPickChord(chordBar, null);
              setChordBar(null);
            }}
          >
            No chord
          </button>
        </SheetContent>
      </Sheet>
      <Sheet
        open={soundCell !== null}
        onOpenChange={(open) => {
          if (!open) setSoundCell(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="jam-root jam-bottom-sheet jam-cell-sheet"
        >
          <SheetTitle>
            {soundCell ? LABELS[soundCell.kind] : "Sound"}
          </SheetTitle>
          <SheetDescription>Shape this square</SheetDescription>
          <div className="jam-cell-options">
            {[-1, 1].map((delta) => (
              <button
                type="button"
                className="jam-btn"
                key={delta}
                onClick={() => {
                  if (!soundCell) return;
                  if (soundCell.kind === "bass")
                    props.onBassWheel(soundCell.index, delta);
                  else
                    props.onLevelChange(soundCell.kind, soundCell.index, delta);
                }}
              >
                {soundCell?.kind === "bass"
                  ? delta < 0
                    ? "Lower"
                    : "Higher"
                  : delta < 0
                    ? "Softer"
                    : "Louder"}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={props.rangeOpen} onOpenChange={props.onRangeOpen}>
        <SheetContent side="bottom" className="jam-root jam-bottom-sheet">
          <SheetTitle>Select bars</SheetTitle>
          <SheetDescription>
            The band will work on these bars, across every sound.
          </SheetDescription>
          <div className="jam-range-pickers">
            <label>
              From
              <select
                aria-label="First bar"
                value={rangeStart}
                onChange={(e) => setRangeStart(Number(e.target.value))}
              >
                {Array.from({ length: bars }, (_, bar) => (
                  <option key={bar} value={bar}>
                    Bar {bar + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select
                aria-label="Last bar"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(Number(e.target.value))}
              >
                {Array.from({ length: bars }, (_, bar) => (
                  <option key={bar} value={bar}>
                    Bar {bar + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="jam-primary"
            onClick={() => {
              props.onPage(Math.min(rangeStart, rangeEnd));
              props.onSelect({
                tracks: [...TRACK_ORDER],
                barStart: Math.min(rangeStart, rangeEnd),
                barEnd: Math.max(rangeStart, rangeEnd),
              });
              props.onRangeOpen(false);
            }}
          >
            Select bars
          </button>
        </SheetContent>
      </Sheet>
      <Sheet
        open={noteBar !== null}
        onOpenChange={(open) => {
          if (!open) setNoteBar(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="jam-root jam-bottom-sheet jam-note-sheet"
          showClose={false}
        >
          <SheetTitle className="sr-only">
            Note on bar {(noteBar ?? 0) + 1}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Leave a note for a bandmate.
          </SheetDescription>
          {noteBar !== null && (
            <BarCommentPopover
              key={noteBar}
              bar={noteBar}
              comments={props.comments.filter((c) => c.bar === noteBar)}
              onClose={() => setNoteBar(null)}
              onSubmit={props.onAddComment}
              onSeeIdea={props.onSeeIdea}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
