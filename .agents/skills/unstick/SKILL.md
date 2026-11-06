---
name: unstick
description: Use when the user presses "Unstick me" or says they're stuck, bored, or the loop feels stale. Diagnose the groove and get three bandmates to each propose one idea.
---
# Unstick me

1. Read `view-screen`, the active `selection`, `get-session`, and `get-taste`. Use the visible session id; pass the selected tracks and 0-based bar range, or `none` when there is no selection.
2. Call `analyze-groove` exactly once. Choose its strongest supported note and state one diagnosis sentence.
3. In one parallel batch, make three separate `agent-teams` calls using the exact spawn shape below, once each for Drummer, Bassist, and Keys. Give each a one-idea assignment and pass the session id, diagnosis, selection, and `get-taste` summary in `instructions`. Save each returned `taskId`.
4. Do not call a generator or `propose-ideas` yourself. Use the explicit status and result calls below for each returned `taskId`. Wait until all three tasks are terminal, read each result, then call `get-session` to verify the new ideas are in the tray and authored by Drummer, Bassist, and Keys.
5. Close with one producer-language sentence containing the diagnosis and the verified result. If a task or idea is missing, say so plainly; never claim three ideas landed when they did not.

## Exact agent-teams calls

`agent-teams` takes one flat object per call. **Every call requires a top-level
`action`**, including monitoring and reading results. Do not wrap calls in
`tool_uses`, `recipient_name`, or `parameters`: those are not agent-teams fields.
Do not send an empty object, an array of agents, or an object containing only
`taskId`. Parallel means issuing three separate tool calls in the same batch;
if separate parallel calls are unavailable, issue them individually.

The failed Trap test call nested three `read-result` calls inside a `tool_uses`
object. Their nested `action` fields did not satisfy the required top-level
`action`. Call `agent-teams` directly with each result-read object shown below.

Spawn calls (replace the angle-bracket context with the facts read in steps 1–2):

```json
{"action":"spawn","agent":"Drummer","name":"Drummer","task":"Propose exactly one changed drum idea, then return its saved idea id and a one-sentence summary.","instructions":"Session id: <sessionId>. Diagnosis: <diagnosis>. Selection: <tracks and 0-based bar range, or none>. Taste: <get-taste summary>. Use your Drummer profile; propose only, never apply."}
```

```json
{"action":"spawn","agent":"Bassist","name":"Bassist","task":"Propose exactly one changed bass idea, then return its saved idea id and a one-sentence summary.","instructions":"Session id: <sessionId>. Diagnosis: <diagnosis>. Selection: <tracks and 0-based bar range, or none>. Taste: <get-taste summary>. Use your Bassist profile; propose only, never apply."}
```

```json
{"action":"spawn","agent":"Keys","name":"Keys","task":"Propose exactly one changed chord idea, then return its saved idea id and a one-sentence summary.","instructions":"Session id: <sessionId>. Diagnosis: <diagnosis>. Selection: <tracks and 0-based bar range, or none>. Taste: <get-taste summary>. Use your Keys profile; propose only, never apply."}
```

Monitor each spawned task using its returned id:

```json
{"action":"status","taskId":"<returned taskId>","waitMs":20000}
```

If it is still queued or running, it is not done. Once terminal, read its result:

```json
{"action":"read-result","taskId":"<returned taskId>"}
```

If a task listing is needed, the complete call is:

```json
{"action":"list"}
```

These shapes match Core 0.223.0's installed
`dist/server/agent-chat/browser-team-tools.js` (`required: ["action"]`).
