---
name: jam-controls
description: Use when the user asks for a knob, slider, fader, or control for some musical parameter (hat energy, swing, tempo, bass movement, darkness).
---
# Jam controls (inline generative UI)

Render a transient inline extension (`render-inline-extension`) — one dark, hardware-style control with a label and live value. If the user says "keep it" / "save this", use `create-extension` instead (same `name`/`description`/`content`) so it persists. A pre-built persisted "Hat Energy" extension already exists and shows in the Controls strip under the transport; don't recreate it.

Map the control to an action:
| Control | On change (debounced ~250ms) |
|---|---|
| swing, tempo, key | `update-transport` |
| "<row> energy/busyness" | `set-energy` with `track` (kick/snare/hat) and `level` 0–1 |
| darkness/brightness | `transform` → `keep-idea` (direct apply is OK here; the user is dragging) |

Never call the LLM from the control. One control per request unless asked.

## Exact payload

Get the session id from `view-screen` / the current route (`/s/:id`) and pass it in `context` (a JSON **string**); the iframe reads it as `window.slotContext.sessionId`.

```json
{
  "name": "Hat energy",
  "description": "Slider for hi-hat density",
  "initialHeight": 72,
  "context": "{\"sessionId\":\"<SESSION_ID>\",\"track\":\"hat\"}",
  "content": "<div x-data=\"jamSlider\" class=\"p-3\" style=\"background:#121216;border:1px solid #26262d;border-radius:6px;font-family:ui-monospace,monospace;color:#d9d9de\"><div class=\"flex items-center justify-between\" style=\"margin-bottom:6px\"><span style=\"font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7b7b86\">Hat energy</span><span x-text=\"pct + '%'\" style=\"font-size:12px;color:#2fd4e6\"></span></div><input type=\"range\" min=\"0\" max=\"100\" x-model.number=\"pct\" @input=\"onInput()\" style=\"width:100%;accent-color:#2fd4e6\"></div><script>document.addEventListener('alpine:init',()=>{Alpine.data('jamSlider',()=>({pct:50,sessionId:'',timer:null,init(){const a=c=>{if(c&&c.sessionId)this.sessionId=String(c.sessionId)};a(window.slotContext);if(window.onSlotContext)window.onSlotContext(a)},onInput(){clearTimeout(this.timer);this.timer=setTimeout(()=>appAction('set-energy',{sessionId:this.sessionId,track:'hat',level:this.pct/100}),250)}}))});</script>"
}
```

Rules learned the hard way:
- Register components inside `document.addEventListener('alpine:init', ...)`. Calling `Alpine.data(...)` bare in a body `<script>` fails (Alpine loads deferred), leaving `x-data="name"` undefined.
- `appAction(name, params)` POSTs `/_agent-native/actions/<name>`; for other params swap the action and args (e.g. `update-transport` `{sessionId, swing}`).
- Swap `track`/label for snare or kick; for swing use `update-transport` with `swing` 0–1.
- Reference implementation: `app/components/jam/controls/hat-energy.ts` (also seeded on first run by `ControlsStrip`).

## Kits and describe-to-start

Vibes: `lofi`, `boombap` (Hip-hop), `trap`, `house`, `empty`. Kits: `dusty`, `boombap`, `808`, `clean`. “Make it more trap” / “change the drums to 808” means `update-transport` with `{sessionId, kit:"808"}`; propose pattern changes separately. A kit control uses this same action and never generates notes or restarts the loop.

For a new-sketch description (the “Or describe it…” entry point):
1. `view-screen` first; treat the description as intent to create a NEW sketch.
2. Choose the closest vibe and kit. Call `create-session` with `seed`, `kit`, and a short `name`. Omit transport values unless the user specified them so the vibe's defaults apply.
3. Read `get-session` and `get-taste`. Use read-only generators (`vary-pattern`, `add-fill`, `transform`, `progression-patch`) to make three distinct ideas that change the seeded grid. Empty starters need progression-patch or add-fill to produce a real change.
4. `propose-ideas` with the right bandmate authors. Do not keep/apply ideas.
5. Verify the saved session and ideas with `get-session`, then `navigate` with `{path:"/s/<created session id>"}` (the action accepts `path`, not `sessionId`). Tell the artist what feel you chose in one sentence. Leave playback stopped.
