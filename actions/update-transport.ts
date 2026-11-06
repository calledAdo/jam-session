import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getSession, updateTransport } from "../server/sessions/store.js";
import {
  bpmSchema,
  kitSchema,
  rootSchema,
  scaleSchema,
  swingSchema,
} from "./lib/session-schemas.js";

export default defineAction({
  description:
    "Change a session's transport: BPM, root note, scale, swing, and/or sound kit (dusty, boombap, 808, clean). dryRun:true validates and returns proposed transport fields without writing; ALWAYS use it for control probes. Kit changes preserve every grid cell. Changes are audible from the next bar, so the loop keeps running.",
  schema: z
    .object({
      id: z.string().min(1).optional().describe("Session id."),
      // Every other jam action names this `sessionId`; generated controls
      // and the agent use that spelling, so accept it here too.
      sessionId: z
        .string()
        .min(1)
        .optional()
        .describe("Session id (alias of id)."),
      bpm: bpmSchema.optional(),
      root: rootSchema.optional(),
      scale: scaleSchema.optional(),
      swing: swingSchema.optional(),
      kit: kitSchema.optional(),
      dryRun: z
        .boolean()
        .optional()
        .describe(
          "True for read-only validation/probing: validate session existence and return sessionId, proposed transport patch, dryRun:true, applied:false without saving. Omit or false to write.",
        ),
    })
    .refine((input) => input.id ?? input.sessionId, {
      message: "Provide the session id as `sessionId` (or `id`).",
    })
    .refine(
      (input) =>
        [input.bpm, input.root, input.scale, input.swing, input.kit].some(
          (value) => value !== undefined,
        ),
      {
        message: "Provide at least one of bpm, root, scale, swing, or kit.",
      },
    ),
  planMode: {
    effect: (args) => (args.dryRun === true ? "read" : "write"),
  },
  run: async ({ id, sessionId, dryRun, ...transport }) => {
    if (dryRun) {
      const targetId = (id ?? sessionId)!;
      await getSession(targetId);
      return {
        sessionId: targetId,
        dryRun: true,
        applied: false,
        patch: transport,
      };
    }
    return updateTransport((id ?? sessionId)!, transport);
  },
});
