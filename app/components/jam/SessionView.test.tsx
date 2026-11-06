// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  busy: false,
  ensure: vi.fn(),
  send: vi.fn(),
  createThread: vi.fn(),
  engine: { playing: false, start: vi.fn(), stop: vi.fn(), setState: vi.fn() },
}));
const sketch = {
  session: {
    id: "sketch",
    name: "Late night",
    bpm: 82,
    root: "C",
    scale: "minor",
    swing: 0.25,
    kit: "dusty",
    bars: 1,
  },
  tracks: [],
  ideas: [],
  comments: [],
};
vi.mock("@agent-native/core/client/agent-chat", () => ({
  useAgentChatGenerating: () => [mocks.busy, mocks.send],
  useChatThreads: () => ({ createThread: mocks.createThread }),
  sendToAgentChatAndConfirm: mocks.send,
  requestAgentChatThreadOpen: vi.fn(),
}));
vi.mock("@agent-native/core/client/application-state", () => ({
  writeClientAppState: vi.fn().mockResolvedValue(undefined),
  deleteClientAppState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@agent-native/core/client/hooks", () => ({
  getBrowserTabId: () => "test-tab",
  useActionQuery: (name: string) => ({
    data: name === "get-session" ? sketch : { summary: "Keep it lo-fi" },
  }),
  useActionMutation: (name: string) => ({
    isPending: false,
    mutate: name === "ensure-band-agents" ? mocks.ensure : vi.fn(),
  }),
  useDbSync: vi.fn(),
}));
vi.mock("@agent-native/core/client/host", () => ({
  defineClientAction: (action: unknown) => action,
}));
vi.mock("@agent-native/core/client/webmcp", () => ({
  createAgentNativeWebMcpRegistration: () => ({
    supported: true,
    registered: 3,
    start: async () => undefined,
    stop: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/lib/jam/audio", () => ({ getJamEngine: () => mocks.engine }));
vi.mock("./BandActivity", () => ({ BandActivity: () => null }));
vi.mock("./Grid", () => ({ Grid: () => null }));
vi.mock("./TransportBar", () => ({ TransportBar: () => null }));
// Only replace the framework panel boundary; exercise the real SessionView handoff.
vi.mock("@agent-native/toolkit/app/chat", () => ({
  AgentPanel: ({
    composerPlaceholder,
    suggestions,
    suggestionPlacement,
  }: {
    composerPlaceholder: string;
    suggestions: unknown[];
    suggestionPlacement: string;
  }) => (
    <div
      data-suggestions={suggestions.length}
      data-placement={suggestionPlacement}
    >
      <textarea placeholder={composerPlaceholder} />
    </div>
  ),
}));

import { SessionView } from "./SessionView";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.busy = false;
  mocks.createThread.mockResolvedValue("jam-thread");
  mocks.send.mockResolvedValue({ delivered: true, tabId: "jam-thread" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  expect(mocks.engine.start).not.toHaveBeenCalled();
});
function render() {
  act(() =>
    root.render(
      <MemoryRouter>
        <SessionView sessionId="sketch" />
      </MemoryRouter>,
    ),
  );
}
function jamButton() {
  return host.querySelector<HTMLButtonElement>(".jam-help-band")!;
}

describe("band conversation entry", () => {
  it("keeps the composer and a secondary team button without prompt suggestions", () => {
    render();
    expect(host.querySelector("textarea")?.placeholder).toBe("Tell the band…");
    expect(
      host.querySelector("[data-suggestions='0'][data-placement='hidden']"),
    ).not.toBeNull();
    expect(jamButton().textContent).toBe("Jam with the band");
    expect(jamButton().classList.contains("jam-primary")).toBe(false);
    const labels = [...host.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    for (const removed of [
      "Busier",
      "Calmer",
      "Darker",
      "Brighter",
      "Build up into the next part",
      "Surprise me",
      "I'm stuck — help me",
    ])
      expect(labels).not.toContain(removed);
  });

  it("acknowledges the team request immediately and prevents overlapping clicks", async () => {
    render();
    act(() => jamButton().click());
    expect(jamButton().disabled).toBe(true);
    expect(jamButton().textContent).toBe("The band is thinking…");
    act(() => jamButton().click());
    expect(mocks.ensure).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
    await act(async () => mocks.ensure.mock.calls[0]![1].onSuccess());
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unstick me",
        targetTabId: "jam-thread",
        submit: true,
        context: expect.stringContaining("0-based bars 0-0"),
      }),
    );
  });

  it("blocks a team request during chat work and frees the button when it ends", () => {
    mocks.busy = true;
    render();
    expect(jamButton().disabled).toBe(true);
    expect(jamButton().textContent).toBe("The band is thinking…");
    act(() => jamButton().click());
    expect(mocks.ensure).not.toHaveBeenCalled();
    mocks.busy = false;
    render();
    expect(jamButton().disabled).toBe(false);
    expect(jamButton().textContent).toBe("Jam with the band");
  });

  it("allows a retry when band setup fails", () => {
    render();
    act(() => jamButton().click());
    act(() =>
      mocks.ensure.mock.calls[0]![1].onError(new Error("Band unavailable")),
    );
    expect(host.textContent).toContain("Band unavailable");
    expect(jamButton().disabled).toBe(false);
    act(() => jamButton().click());
    expect(mocks.ensure).toHaveBeenCalledTimes(2);
  });
});
