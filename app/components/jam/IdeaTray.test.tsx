// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IdeaData, TrackData } from "@/lib/jam/grid";

import { IdeaTray } from "./IdeaTray";

const idea: IdeaData = {
  id: "keys-idea",
  sessionId: "sketch",
  author: "Keys",
  label: "A warmer way home",
  rationale: "Leave a little room for the melody.",
  status: "pending",
  patch: [{ track: "keys", fromStep: 0, steps: ["VI"] }],
};
const tracks: TrackData[] = [{ kind: "keys", steps: ["i7"] }];
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(
  overrides: Partial<React.ComponentProps<typeof IdeaTray>> = {},
) {
  const props = {
    ideas: [idea],
    tracks,
    root: "D",
    scale: "minor",
    auditionId: null,
    editingId: null,
    draft: null,
    highlightId: null,
    playing: false,
    onAudition: vi.fn(),
    onKeep: vi.fn(),
    onToss: vi.fn(),
    onEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onKeepEdited: vi.fn(),
    onTogglePlay: vi.fn(),
    ...overrides,
  };
  act(() => root.render(<IdeaTray {...props} />));
  return props;
}
function button(label: string) {
  const result = [...host.querySelectorAll("button")].find(
    (e) => e.textContent?.trim() === label,
  );
  if (!result) throw Error(`Missing ${label}`);
  return result;
}
describe("beginner idea decisions", () => {
  it("uses plain labels and resolves chord names without exposing numerals", () => {
    render();
    for (const label of ["Listen", "Use it", "Skip", "Tweak"])
      expect(button(label)).toBeTruthy();
    expect(host.textContent).toContain("Dm7");
    expect(host.textContent).toContain("B♭");
    expect(host.textContent).not.toContain("VI");
    expect(host.textContent).not.toContain("Keep");
  });
  it("tweaks without applying or starting an audition", () => {
    const props = render();
    act(() => button("Tweak").click());
    expect(props.onEdit).toHaveBeenCalledWith(idea);
    expect(props.onKeep).not.toHaveBeenCalled();
    expect(props.onAudition).not.toHaveBeenCalled();
  });
  it("keeps the explicit tweaked decision separate from the original proposal", () => {
    const props = render({
      editingId: idea.id,
      draft: [{ track: "keys", fromStep: 0, steps: ["iv"] }],
    });
    act(() => button("Use tweaked").click());
    expect(props.onKeepEdited).toHaveBeenCalledWith(idea);
    expect(props.onKeep).not.toHaveBeenCalled();
    act(() => button("Cancel").click());
    expect(props.onCancelEdit).toHaveBeenCalledOnce();
  });
  it("blocks no-op and in-flight uses", () => {
    render({
      ideas: [
        { ...idea, patch: [{ track: "keys", fromStep: 0, steps: ["i7"] }] },
      ],
    });
    expect(button("Use it").disabled).toBe(true);
    const props = render({ busy: true });
    act(() => button("Use it").click());
    expect(props.onKeep).not.toHaveBeenCalled();
    expect(button("Skip").disabled).toBe(true);
    expect(button("Tweak").disabled).toBe(true);
  });
});
