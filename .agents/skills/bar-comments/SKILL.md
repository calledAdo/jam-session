---
name: bar-comments
scope: both
description: Use when a bar-note context arrives from the UI or the user asks about a note left on a bar. Read the note, answer in one bandmate's voice with a single bar-scoped idea, and reply through answer-comment without touching the grid.
---
# Bar note → one idea → one reply

1. Read `view-screen`, `get-session`, `get-taste`, and `list-comments` for the session. Match the `commentId` and 0-based `bar` from the context; act on that note only. If it is already answered, say so and stop.
2. Read the note text and the current grid at that bar. Pick the bandmate whose part fixes it: **Drummer** for kick/snare/hat feel, **Bassist** for low end and movement, **Keys** for harmony, **Bandmate** only when the fix spans parts. Avoid anything `get-taste` says was tossed.
3. Build exactly ONE bar-scoped patch with a read-only generator — `vary-pattern`, `add-fill`, `transform`, or `progression-patch`. Constrain it to the note's bar: pass the bar range (0-based) and only the tracks the chosen bandmate owns. Check the returned patch stays inside that bar (keys index = bar; other tracks = bar × 16 through bar × 16 + 15). Do not invent freehand notes and do not call `set-steps`, `apply-progression`, or `keep-idea`.
4. Compare the patch to the current grid. If it changes nothing, adjust the generator parameters once and retry; never propose a no-op.
5. Call `propose-ideas` with one idea authored by that bandmate. Keep the label and rationale tied to the note ("tighter kick on 3", "smoother turnaround").
6. Call `answer-comment` with the `commentId`, the new `ideaId`, `replyAuthor` set to the same bandmate, and a `reply` that is ONE short first-person sentence about what you changed (for example: "I laid off the hats there so the kick can breathe — it's in your tray."). Up to 160 characters.
7. Close with one producer-language sentence that states the note, the bandmate, and the idea waiting in the tray. Never claim the grid changed.
