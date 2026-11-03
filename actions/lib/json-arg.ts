/**
 * CLI flags arrive as strings. Accept either a real value from HTTP/UI callers
 * or a JSON string such as --steps '[1,0,0,1]'.
 */
export function parseJsonArg(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    !trimmed.startsWith("[") &&
    !trimmed.startsWith("{") &&
    !trimmed.startsWith('"') &&
    trimmed !== "null"
  ) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Expected JSON, received: ${trimmed.slice(0, 80)}`);
  }
}
