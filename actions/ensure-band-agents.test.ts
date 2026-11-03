import { beforeEach, describe, expect, it, vi } from "vitest";

const { resourceListMock, resourcePutIfAbsentMock } = vi.hoisted(() => ({
  resourceListMock: vi.fn(),
  resourcePutIfAbsentMock: vi.fn(),
}));

vi.mock("@agent-native/core/resources/store", () => ({
  resourceList: resourceListMock,
  resourcePutIfAbsent: resourcePutIfAbsentMock,
}));

import ensureBandAgents from "./ensure-band-agents.js";

const run = ensureBandAgents.run as (
  args: Record<string, never>,
  ctx: { caller: "tool"; userEmail?: string },
) => Promise<{ created: string[]; profiles: string[] }>;

describe("ensure-band-agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceListMock.mockResolvedValue([]);
    resourcePutIfAbsentMock.mockResolvedValue({ id: "created" });
  });

  it("seeds all three profiles for the authenticated user", async () => {
    resourceListMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { path: "agents/drummer.md" },
        { path: "agents/bassist.md" },
        { path: "agents/keys.md" },
      ]);
    await expect(
      run({}, { caller: "tool", userEmail: "producer@example.com" }),
    ).resolves.toEqual({
      created: ["Drummer", "Bassist", "Keys"],
      profiles: ["Drummer", "Bassist", "Keys"],
    });
    expect(resourceListMock).toHaveBeenCalledWith(
      "producer@example.com",
      "agents/",
    );
    expect(resourcePutIfAbsentMock).toHaveBeenCalledTimes(3);
  });

  it("does not overwrite an existing profile and tolerates a concurrent seed", async () => {
    resourceListMock
      .mockResolvedValueOnce([{ path: "agents/drummer.md" }])
      .mockResolvedValueOnce([
        { path: "agents/drummer.md" },
        { path: "agents/bassist.md" },
        { path: "agents/keys.md" },
      ]);
    resourcePutIfAbsentMock
      .mockResolvedValueOnce({ id: "created" })
      .mockResolvedValueOnce(null);

    await expect(
      run({}, { caller: "tool", userEmail: "producer@example.com" }),
    ).resolves.toEqual({
      created: ["Bassist"],
      profiles: ["Drummer", "Bassist", "Keys"],
    });
    expect(resourcePutIfAbsentMock).toHaveBeenCalledTimes(2);
  });

  it("fails when a profile is still missing after the writes", async () => {
    resourceListMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ path: "agents/drummer.md" }]);

    await expect(
      run({}, { caller: "tool", userEmail: "producer@example.com" }),
    ).rejects.toThrow("Could not verify all three bandmate agent profiles.");
  });

  it("requires an authenticated user", async () => {
    await expect(run({}, { caller: "tool" })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(resourceListMock).not.toHaveBeenCalled();
  });
});
