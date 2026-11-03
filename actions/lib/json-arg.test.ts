import { describe, expect, it } from "vitest";

import { parseJsonArg } from "./json-arg.js";

describe("parseJsonArg", () => {
  it("passes non-string values through", () => {
    const value = [1, 2, 3];
    expect(parseJsonArg(value)).toBe(value);
    expect(parseJsonArg(true)).toBe(true);
  });

  it("parses JSON arrays and objects from CLI strings", () => {
    expect(parseJsonArg("[1,0,0,1]")).toEqual([1, 0, 0, 1]);
    expect(parseJsonArg('{"track":"kick"}')).toEqual({ track: "kick" });
  });

  it("treats empty strings as omitted", () => {
    expect(parseJsonArg("")).toBeUndefined();
    expect(parseJsonArg("   ")).toBeUndefined();
  });

  it("leaves plain strings alone", () => {
    expect(parseJsonArg("i")).toBe("i");
    expect(parseJsonArg("lofi")).toBe("lofi");
  });

  it("rejects malformed JSON", () => {
    expect(() => parseJsonArg("[1, 0")).toThrow(/Expected JSON/);
  });
});
