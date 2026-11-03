---
name: unstick
description: Use when the user presses "Unstick me" or says they're stuck, bored, or the loop feels stale. Diagnose the groove and get three bandmates to each propose one idea.
---
# Unstick me

1. Call `analyze-groove` for the current session. Read `notes`, `density`, `downbeatRatio`, `repetitionScore`, `emptyRows`.
2. Pick the **single** most useful diagnosis. Heuristics, in order:
   - `repetitionScore` > 0.8 → "it's the same bar over and over" → variation / fill at bar 4 or 8.
   - `downbeatRatio` > 0.7 → "everything lands on the one" → syncopation, drop the kick before the change.
   - an empty row (`emptyRows`) → "the {row} is missing" → give that row a part.
   - `registerGap` → "the midrange is empty" → keys/bass movement.
3. Say the diagnosis in one sentence, like a friend in the room.
4. Delegate to three sub-agents in parallel (agent teams), one per bandmate. Each makes exactly one idea and calls `propose-ideas` with `author` set to its role:
   - **Drummer** — kick/snare/hat only (`add-fill`, `vary-pattern`, `transform simplify`).
   - **Bassist** — bass only (`vary-pattern`, `transform darker/brighter`).
   - **Keys** — chords only (`apply-progression`).
   Give each sub-agent the session id, the diagnosis, the selection (if any), and the user's taste notes.
5. Finish with: "Three ideas in the tray — audition them and keep what moves you." Don't apply anything yourself.
