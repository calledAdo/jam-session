import type {
  AgentEvent,
  AgentThreadSnapshot,
  AgentToolCall,
  AgentTransport,
} from "@agent-native/agentkit/protocol";
import { createAgentNativeAgentKitTransport } from "@agent-native/core/client/agentkit-chat/transport";
import type { AssistantChatProps } from "@agent-native/toolkit/app/chat";

const CONTROL_TOOLS = new Set([
  "render-inline-extension",
  "show-extension-inline",
  "create-extension",
]);

function controlTool(tool: AgentToolCall): AgentToolCall {
  if (
    !CONTROL_TOOLS.has(tool.name) ||
    tool.status !== "completed" ||
    !tool.metadata?.chatUI
  )
    return tool;
  // The attached widget owns the interactive UI. Keeping chatUI on the same
  // tool also mounts it as a durable result above the work disclosure.
  const { chatUI: _chatUI, ...metadata } = tool.metadata;
  return { ...tool, metadata };
}

export function bandChatEvent(event: AgentEvent): AgentEvent {
  if (event.type === "tool.started" || event.type === "tool.updated") {
    return { ...event, toolCall: controlTool(event.toolCall) };
  }
  return event;
}

export function bandChatSnapshot(
  snapshot: AgentThreadSnapshot,
): AgentThreadSnapshot {
  return {
    ...snapshot,
    ...(snapshot.toolCalls
      ? { toolCalls: snapshot.toolCalls.map(controlTool) }
      : {}),
    ...(snapshot.events ? { events: snapshot.events.map(bandChatEvent) } : {}),
  };
}

export function withBandControls(transport: AgentTransport): AgentTransport {
  return {
    ...transport,
    async getThreadSnapshot(input, context) {
      const snapshot = await transport.getThreadSnapshot?.(input, context);
      return snapshot ? bandChatSnapshot(snapshot) : null;
    },
    async *subscribeToRun(input) {
      for await (const event of transport.subscribeToRun(input)) {
        yield bandChatEvent(event);
      }
    },
  };
}

export const createBandChatTransport: NonNullable<
  AssistantChatProps["createTransport"]
> = (context) =>
  withBandControls(
    createAgentNativeAgentKitTransport({
      apiUrl: context.apiUrl,
      ...(context.streamingUrl ? { streamingUrl: context.streamingUrl } : {}),
      ...(context.threadId ? { threadId: context.threadId } : {}),
      ...(context.browserTabId ? { browserTabId: context.browserTabId } : {}),
      surface: context.surface,
      get model() {
        return context.modelRef.current!;
      },
      get engine() {
        return context.engineRef.current!;
      },
      get effort() {
        return context.effortRef.current!;
      },
      get scope() {
        return context.scopeRef.current;
      },
      // Task conversations are unscoped. Resource context still accompanies
      // submissions; Core continues to enforce caller access to every thread.
      isolateHistoryByScope: false,
      adapter: { textFormat: "markdown" },
    }),
  );
