---
name: jam-controls
description: Use when the user asks for a knob, slider, fader, or control for some musical parameter (hat energy, swing, tempo, bass movement, darkness).
---
# Jam controls (inline generative UI)

Render a transient inline extension (`render-inline-extension`) — one dark, hardware-style control with a label and live value. If the user says "keep it" / "save this", use `create-extension` instead so it persists.

Map the control to an action:
| Control | On change (debounced ~250ms) |
|---|---|
| swing, tempo, key | `update-transport` |
| "<row> energy/busyness" | `set-energy` with `track` and `level` 0–1 |
| darkness/brightness | `transform` → `keep-idea` (direct apply is OK here; the user is dragging) |

Use the extension bridge to call actions (see the extensions docs); never call the LLM from the control. One control per request unless asked.
