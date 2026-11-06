---
name: jam-controls
description: Use when the user asks for a knob, slider, fader, picker, or control for a musical parameter (hat energy, swing, tempo, bass movement, fill type, darkness, chord busyness). Inspect schemas and reversibly test supported values before building; decline unsupported controls.
---
# Jam controls (inline generative UI)

Before writing HTML or rendering/saving a control, complete the schema check and reversible probes below. Then render a transient inline extension (`render-inline-extension`) — one dark, hardware-style control with a label and live value. If the user says "keep it" / "save this", use `create-extension` instead (same `name`/`description`/`content`) so it persists. If reusing an existing saved control, inspect its actual content, check its payloads, complete the same probes, then display it with `show-extension-inline`. Never assume an old Controls strip or pre-built Hat Energy control is visible in the current UI.

## Look before building — required on every request

1. Call `view-screen`; read `selection` and the current session/transport. Use the selected bars, with 0-based indices. Leave playback stopped during verification; never start audio to test a control.
2. Discover the target through the framework's **`tool-search`**, not a guessed schema action. For an energy control, send this tool input:
   ```json
   {"names":["set-energy","get-session","list-edits","undo-last","render-inline-extension"]}
   ```
   For fill type, load `add-fill`; for tone, load `transform`; for transport, load `update-transport`. Also load every downstream action the control will call (for example `propose-ideas` and `keep-idea` when applying a generated patch). If an action is already callable with its full schema visible, read that schema directly.
3. **Wait for the next model step.** Targeted `tool-search` loads the full schemas there; the search result's abbreviated parameter summary/menu is not the contract. Read required fields, exact property names, enums, numeric minimum/maximum and integer constraints, nested selection/patch shapes, and action descriptions/side effects. Verify the action is HTTP-mounted and extension-callable; an agent-only (`http: false`) or `toolCallable: false` action cannot power `appAction`.
4. Construct the exact payloads from those schemas. Bind session/bar context from the fresh screen; clamp numeric values, honor integer steps, and allowlist picker values. A UI range of 0–100 must map to an action range of 0–1 by dividing by 100. Do not pass labels as enum values, extra invented parameters, or notes made up by the LLM. Tables and examples here are hints; the **current loaded schema wins**.
5. If schema details or extension exposure remain unclear, use the installed framework readers, in order:
   - `docs-search` with `{"query":"actions"}`, then `{"slug":"actions-defining"}`; `{"slug":"generative-ui"}` documents the extension bridge.
   - `source-search` with `{"query":"tool-search"}`, then `{"path":"core/dist/agent/tool-search.js"}` for discovery; `{"path":"core/dist/extensions/actions.js"}` and `{"path":"core/dist/extensions/html-shell.js"}` for extension behavior.
   - Developer CLI equivalents: `pnpm action docs-search --slug generative-ui` and `pnpm action source-search --path core/dist/agent/tool-search.js`. With repo access, inspect the actual `actions/<name>.ts` and its imported schema helpers for refinements/business constraints missing from JSON Schema. Do not fabricate a schema-reading endpoint or a `dryRun` parameter.

If no callable action supports the requested parameter, **do not probe an invalid value, write HTML, render, or save anything**. Reply in one sentence with the limitation and closest supported control, e.g. “Keys holds one chord per bar, so chord busyness isn't supported; I can give you a bass or hat energy knob.” Never silently substitute another parameter.

## Test before showing — required before render or save

The request for a control authorizes these temporary checks; it does not authorize leaving test edits behind. Keep a restoration ledger and run probes sequentially, without other grid edits interleaved.

1. Read `get-session` and `list-edits` as a baseline: retain all tracks, transport values, and existing edit IDs. Check the current selection against session bounds. Do not rely on the tool returning a checkmark; inspect each result and re-read saved state.
2. Call the **real target action with the exact payload the control will send**, at both minimum and maximum for a knob/slider, or once for **every** allowed picker option. For bass: `set-energy` with `{sessionId, track:"bass", level:0}`, then `level:1`; hats use `track:"hat"`. No unsupported-value/negative probes: the Inspector must have zero failed calls. Inspect success and `get-session`/`list-edits` after writes; test any downstream apply actions too if the control applies patches.
3. Restore before rendering/saving:
   - For grid mutations, call `undo-last` **once per edit actually created by the probes**, in reverse order, then read `get-session` / `list-edits`. Normally two endpoint writes mean two undos; never count a failed or no-op call (`applied:false`, empty patch, no new edit ID) as an edit. Undoing it would remove the artist's earlier work. Stop if the newest edit is not one from this ledger.
   - Read-only generators (`add-fill`, `transform`) return patches without creating edits. Test all options/endpoints, but **zero writes means zero undos**. Do not create ideas merely to test a read-only preview. If testing a write chain, track its grid edits separately and undo those; idea/taste side effects are not undone by `undo-last`, so do not silently create those during preflight.
   - `update-transport` creates no grid-history edit. Test its endpoints/options, then restore the captured fields with `update-transport`; do **not** call `undo-last` for transport probes.
4. Compare restored grid values, transport fields, and original edit IDs to the baseline. If a call fails, stop, restore any successful changes using the ledger, and report the failure honestly. Do not show/save the control until the full supported range/options pass and restoration is verified. If safe restoration cannot be established, explain the blocker instead of probing or undoing unrelated work.
5. **Finish by actually displaying the requested control** with `render-inline-extension`, `create-extension`, or the verified `show-extension-inline` reuse path. Reporting that tests passed is not a control. Do not stop after preflight or merely point to an assumed existing control.

## Supported mappings (recheck the live schema)

Map the control to an action:

| Control | On change (debounced ~250ms) |
|---|---|
| swing, tempo, key | `update-transport` |
| "<row> energy/busyness" | `set-energy` with `track` (kick/snare/hat/bass) and `level` 0–1 |
| fill type picker | `add-fill` with `style` `roll` / `stutter` / `drop`, on the last selected bar; returns a read-only patch preview |
| tone picker | `transform` with `mode` `simplify` / `darker` / `brighter` and the selected bars/tracks; returns a read-only patch preview |

Generators return patches, not idea IDs. A preview picker must label itself as a preview and must not imply the grid changed. Applying a generated patch requires an explicit user Apply/Keep action and a schema-checked write path; never pass a patch to `keep-idea` without a real idea ID. Prefer a preview-only picker over adding an unverified multi-action write chain. Do not offer invented options such as `swell` fills or `dreamy` transform modes. Do not turn a discrete transform enum into a continuous knob with an invented intensity argument.

Never call the LLM from the control. One control per request unless asked.

`set-energy` currently supports exactly `kick`, `snare`, `hat`, and `bass`. Keys energy is unsupported because the keys row stores one chord per bar and has no chord-hit rhythm; decline it using the one-sentence rule above.

`set-energy` rewrites the entire selected row for the session; its schema has no bar-range or selection argument. Make that scope clear in the label/description rather than inventing selection parameters.

Bass energy uses bar-downbeat chord roots below 1/3, kick-following roots from 1/3, eighth notes with in-key octave/fifth movement from 2/3, and sixteenths from 5/6. Missing chords use the tonic; chromatic roots/fifths use the nearest in-key tone. The slider writes through the same undoable edit path as drums.

## Exact payload

Get the session id from `view-screen` / the current route (`/s/:id`) and pass it in `context` (a JSON **string**); the iframe reads it as `window.slotContext.sessionId`.

```json
{
  "name": "Hat energy",
  "description": "Slider for hi-hat density",
  "initialHeight": 72,
  "context": "{\"sessionId\":\"<SESSION_ID>\",\"track\":\"hat\"}",
  "content": "<div x-data=\"jamSlider\" class=\"p-3\" style=\"background:#121216;border:1px solid #26262d;border-radius:6px;font-family:ui-monospace,monospace;color:#d9d9de\"><label for=\"jam-energy\" style=\"font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7b7b86\">Hat energy</label><span x-text=\"pct + '%'\" style=\"font-size:12px;color:#2fd4e6\"></span><input id=\"jam-energy\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" x-model.number=\"pct\" :disabled=\"!sessionId || busy\" @input=\"onInput()\" style=\"width:100%;accent-color:#2fd4e6\"><p role=\"alert\" x-show=\"error\" x-text=\"error\"></p></div><script>document.addEventListener('alpine:init',()=>{Alpine.data('jamSlider',()=>({pct:50,sessionId:'',timer:null,busy:false,error:'',init(){const a=c=>{clearTimeout(this.timer);this.sessionId=typeof c?.sessionId==='string'?c.sessionId:''};a(window.slotContext);window.onSlotContext?.(a)},onInput(){if(!this.sessionId||this.busy)return;clearTimeout(this.timer);this.pct=Math.max(0,Math.min(100,Math.round(Number(this.pct)||0)));const sessionId=this.sessionId,level=this.pct/100;this.timer=setTimeout(async()=>{this.busy=true;this.error='';try{await appAction('set-energy',{sessionId,track:'hat',level})}catch(e){this.error=e.message||'Could not change energy';console.error(e);throw e}finally{this.busy=false}},250)},destroy(){clearTimeout(this.timer)}}))});</script>"
}
```

Rules learned the hard way:

- Register components inside `document.addEventListener('alpine:init', ...)`. Calling `Alpine.data(...)` bare in a body `<script>` fails (Alpine loads deferred), leaving `x-data="name"` undefined.
- `appAction(name, params)` calls the framework action bridge (including method negotiation for GET actions); for other params swap the action and args only after inspecting their schemas (e.g. `update-transport` `{sessionId, swing}`).
- Swap `track`/label for snare, kick, or bass in both the context and `appAction` args; for swing use `update-transport` with `swing` 0–1.
- Reference implementation: `app/components/jam/controls/hat-energy.ts` (also seeded on first run by `ControlsStrip`).

## Validation and errors in the generated control

Core 0.223.0 does not statically validate embedded `appAction` parameters when `render-inline-extension` / `create-extension` accepts HTML. There is no extension build-time schema validator or dry-run option to call. Use full-schema discovery and the real-action preflight above; no new server code is needed. Server input validation still runs for every action call and `appAction` rejects failed requests.

The payload example above is the layout/payload shape, not an exemption from these runtime requirements. Before rendering, add:

- A disabled state until a valid `sessionId`/selection context exists, numeric clamping and exact enum allowlists. Do not call actions from `init()` or context updates; cancel pending debounce timers when context changes.
- Debounced (~250 ms), serialized writes; disable the control while a request is pending, and await completion before accepting another write. A stale response must not overwrite a newer displayed value.
- `try`/`catch`/`finally` around **every** awaited `appAction`: show a short visible error (`role="alert"`), clear pending state, log with `console.error(error)`, and rethrow from the async event/debounce handler so the framework captures the rejected promise for its error toast. Never swallow failures or report success before the action resolves. Never auto-submit an agent chat message from an error handler.
- The existing framework error reporting: `html-shell.js` collects runtime errors/unhandled rejections and console context; the user-triggered **Fix** button sends `agent-native-extension-error-fix`, and Toolkit's `InlineExtensionFrame` routes the details to the current chat. This is runtime recovery, not proof of preflight success. If a future installed version offers build-time validation, read its schema/docs and use it before rendering too.

## Kits and describe-to-start

Vibes: `lofi`, `boombap` (Hip-hop), `trap`, `house`, `empty`. Kits: `dusty`, `boombap`, `808`, `clean`. “Make it more trap” / “change the drums to 808” means `update-transport` with `{sessionId, kit:"808"}`; propose pattern changes separately. A kit control uses this same action and never generates notes or restarts the loop.

For a new-sketch description (the “Or describe it…” entry point):
1. `view-screen` first; treat the description as intent to create a NEW sketch.
2. Choose the closest vibe and kit. Call `create-session` with `seed`, `kit`, and a short `name`. Omit transport values unless the user specified them so the vibe's defaults apply.
3. Read `get-session` and `get-taste`. Use read-only generators (`vary-pattern`, `add-fill`, `transform`, `progression-patch`) to make three distinct ideas that change the seeded grid. Empty starters need progression-patch or add-fill to produce a real change.
4. `propose-ideas` with the right bandmate authors. Do not keep/apply ideas.
5. Verify the saved session and ideas with `get-session`, then `navigate` with `{path:"/s/<created session id>"}` (the action accepts `path`, not `sessionId`). Tell the artist what feel you chose in one sentence. Leave playback stopped.
