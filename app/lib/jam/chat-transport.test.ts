import type {
  AgentEvent,
  AgentThreadSnapshot,
  AgentToolCall,
  AgentTransport,
} from "@agent-native/agentkit/protocol";
import { createAgentNativeAgentKitTransport } from "@agent-native/core/client/agentkit-chat/transport";
import { describe, expect, it, vi } from "vitest";

vi.mock("@agent-native/core/client/agentkit-chat/transport", () => ({
  createAgentNativeAgentKitTransport: vi.fn(),
}));
import {
  createBandChatTransport,
  bandChatEvent,
  bandChatSnapshot,
  withBandControls,
} from "./chat-transport";

const tool: AgentToolCall = {
  id: "control-call",
  name: "render-inline-extension",
  status: "completed",
  runId: "run",
  messageId: "reply",
  input: { name: "Bass" },
  metadata: {
    chatUI: { renderer: "core.inline-extension" },
    customFlag: "preserved",
  },
  output: {
    inlineExtension: {
      mode: "transient",
      id: "inline-1",
      name: "Bass",
      content: '<input type="range">',
    },
  },
};
const widget = {
  id: "control-call:chat-ui",
  kind: "core.inline-extension",
  data: { toolCallId: tool.id },
};
const event: AgentEvent = {
  id: "event",
  threadId: "thread",
  runId: "run",
  sequence: 5,
  occurredAt: "2026-11-06T00:00:00Z",
  type: "widget.created",
  messageId: "reply",
  widget,
};
const snapshot: AgentThreadSnapshot = {
  id: "thread",
  createdAt: event.occurredAt,
  updatedAt: event.occurredAt,
  messages: [
    {
      id: "reply",
      role: "assistant",
      parts: [{ type: "text", text: "Try this." }],
    },
  ],
  toolCalls: [tool],
  widgets: [{ messageId: "reply", widget }],
  events: [event],
};

describe("band control projection", () => {
  it("uses one attached widget renderer on reload and preserves the actual action result", () => {
    const original = structuredClone(snapshot);
    const result = bandChatSnapshot(snapshot);
    expect(result.widgets).toBe(snapshot.widgets);
    expect(result.toolCalls?.[0]?.metadata).toEqual({
      customFlag: "preserved",
    });
    expect(result.toolCalls?.[0]?.output).toBe(tool.output);
    expect(result.messages).toBe(snapshot.messages);
    expect(snapshot).toEqual(original);
    expect(bandChatSnapshot(result)).toEqual(result);
  });

  it.each(["widget.created", "widget.updated"] as const)(
    "preserves the canonical %s frame and stream cursors",
    (type) => {
      const result = bandChatEvent({ ...event, type });
      expect(result).toEqual({ ...event, type });
      expect([
        result.id,
        result.sequence,
        result.runId,
        result.threadId,
      ]).toEqual([event.id, 5, "run", "thread"]);
    },
  );

  it.each([
    "render-inline-extension",
    "create-extension",
    "show-extension-inline",
  ])("keeps %s on the single widget presentation path", (name) => {
    expect(
      bandChatSnapshot({ ...snapshot, toolCalls: [{ ...tool, name }] })
        .toolCalls?.[0]?.metadata?.chatUI,
    ).toBeUndefined();
  });

  it("preserves failed/pending tools, team widgets and other action results", () => {
    const other: AgentEvent = {
      ...event,
      widget: { ...widget, kind: "core.agent-team-progress" },
    };
    expect(bandChatEvent(other)).toBe(other);
    const calls: AgentToolCall[] = [
      { ...tool, status: "failed" },
      { ...tool, status: "running" },
      { ...tool, name: "get-session" },
    ];
    const result = bandChatSnapshot({
      ...snapshot,
      toolCalls: calls,
      widgets: [{ messageId: "reply", widget: other.widget }],
    });
    expect(result.toolCalls).toEqual(calls);
    expect(result.widgets).toHaveLength(1);
  });

  it("normalizes both subscription and restore through the same public transport seam", async () => {
    const source: AgentTransport = {
      getThreadSnapshot: vi.fn().mockResolvedValue(snapshot),
      startRun: vi.fn(),
      cancelRun: vi.fn(),
      subscribeToRun: async function* () {
        yield {
          ...event,
          sequence: 4,
          type: "tool.updated",
          toolCall: tool,
        } as AgentEvent;
        yield event;
      },
    };
    const wrapped = withBandControls(source);
    expect(await wrapped.getThreadSnapshot?.({ threadId: "thread" })).toEqual(
      bandChatSnapshot(snapshot),
    );
    const events = [];
    for await (const entry of wrapped.subscribeToRun({
      threadId: "thread",
      runId: "run",
    }))
      events.push(entry);
    expect(events.map((e) => e.sequence)).toEqual([4, 5]);
    expect(events[1]).toEqual(event);
    expect(
      events[0]?.type === "tool.updated" && events[0].toolCall.metadata?.chatUI,
    ).toBeUndefined();
  });
  it("restores unscoped task threads while keeping current sketch and model context", () => {
    vi.mocked(createAgentNativeAgentKitTransport).mockReturnValue({
      startRun: vi.fn(),
      cancelRun: vi.fn(),
      subscribeToRun: async function* () {},
      dispose: vi.fn(),
    });
    const context: Parameters<typeof createBandChatTransport>[0] = {
      apiUrl: "/_agent-native/agent-chat",
      threadId: "child-thread",
      browserTabId: "browser",
      modelRef: { current: "model-a" },
      engineRef: { current: "engine" },
      effortRef: { current: "auto" },
      surface: "app",
      scopeRef: { current: { type: "jam-session", id: "sketch" } },
    };
    createBandChatTransport(context);
    const options = vi.mocked(createAgentNativeAgentKitTransport).mock
      .lastCall![0]!;
    expect(options.isolateHistoryByScope).toBe(false);
    expect(options.threadId).toBe("child-thread");
    expect(options.scope).toBe(context.scopeRef.current);
    context.modelRef.current = "model-b";
    expect(options.model).toBe("model-b");
  });
});
