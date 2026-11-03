---
name: unstick
description: Use when the user presses "Unstick me" or says they're stuck, bored, or the loop feels stale. Diagnose the groove and get three bandmates to each propose one idea.
---
# Unstick me

1. Read `view-screen`, the active `selection`, `get-session`, and `get-taste`. Use the visible session id; pass the selected tracks and 0-based bar range, or `none` when there is no selection.
2. Call `analyze-groove` exactly once. Choose its strongest supported note and state one diagnosis sentence.
3. In one parallel batch, call `agent-teams` with `action: "spawn"` exactly three times, once each with `agent: "Drummer"`, `agent: "Bassist"`, and `agent: "Keys"`. Give each a one-idea assignment and pass the session id, diagnosis, selection, and `get-taste` summary in `instructions`.
4. Do not call a generator or `propose-ideas` yourself. Wait until all three tasks are terminal, read each result, then call `get-session` to verify the new ideas are in the tray and authored by Drummer, Bassist, and Keys.
5. Close with one producer-language sentence containing the diagnosis and the verified result. If a task or idea is missing, say so plainly; never claim three ideas landed when they did not.
