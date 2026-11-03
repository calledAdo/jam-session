import { defineAction } from "@agent-native/core/action";
import {
  resourceList,
  resourcePutIfAbsent,
} from "@agent-native/core/resources/store";
import { z } from "zod";

import { BAND_AGENT_PROFILES, profilesNeedingSeed } from "./lib/band-agents.js";

export default defineAction({
  description:
    "Ensure the current user's Drummer, Bassist, and Keys custom agent profiles exist.",
  schema: z.object({}),
  run: async (_args, ctx) => {
    const userEmail = ctx?.userEmail?.trim();
    if (!userEmail) {
      throw Object.assign(
        new Error("Authentication required to set up bandmate agents."),
        { statusCode: 401 },
      );
    }

    const existing = await resourceList(userEmail, "agents/");
    const missing = profilesNeedingSeed(existing.map(({ path }) => path));
    const writes = await Promise.all(
      missing.map((profile) =>
        resourcePutIfAbsent(
          userEmail,
          profile.path,
          profile.content,
          "text/markdown",
        ),
      ),
    );
    const verifiedPaths = new Set(
      (await resourceList(userEmail, "agents/")).map(({ path }) => path),
    );
    const profiles = BAND_AGENT_PROFILES.filter(({ path }) =>
      verifiedPaths.has(path),
    ).map(({ name }) => name);
    if (profiles.length !== BAND_AGENT_PROFILES.length) {
      throw new Error("Could not verify all three bandmate agent profiles.");
    }

    return {
      created: missing.flatMap((profile, index) =>
        writes[index] ? [profile.name] : [],
      ),
      profiles,
    };
  },
});
