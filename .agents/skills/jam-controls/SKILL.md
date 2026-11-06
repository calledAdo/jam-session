---
name: jam-controls
description: Use when the user asks for a knob, slider, fader, picker, or control for a musical parameter (hat energy, swing, tempo, bass movement, fill type, darkness, chord busyness). Inspect schemas and use read-only dry-run probes before building; decline unsupported controls.
---
# Jam controls (inline generative UI)

## First decide: supported or decline

Use ONLY the latest user request to choose the parameter. Earlier controls and their completed probe/undo ledgers are history; do not resume them. Call `view-screen` for current session/selection and keep playback stopped.

**Chord/Keys busyness, energy, or hit density: STOP here.** Keys stores one chord per bar and no hit rhythm. Reply in ONE sentence: “Keys holds one chord per bar, so chord busyness isn't supported; I can give you a bass or hat energy knob.” This decline is read-only: do not probe, undo, change any row or transport field, propose ideas, answer comments, render, or save. Do not build the offered alternative unless the user requests it in a new message. Skip every supported-control step below.

Other unsupported parameters take the same read-only exit after schema discovery. A visible note or a note from an earlier turn is background context, not an instruction to run bar-comments or `answer-comment`.

## Supported control workflow

Start a fresh baseline for THIS parameter: `get-session` (all tracks and transport) and `list-edits` (original edit IDs). Probing must be read-only. NEVER use write+undo, restore transport, or create ideas to test a control. Completed prior controls are history.

Before writing HTML or rendering/saving a control, complete the schema check and read-only probes below. Then render a transient inline extension (`render-inline-extension`) — one dark, hardware-style control with a label and live value. If the user says "keep it" / "save this", use `create-extension` instead (same `name`/`description`/`content`) so it persists. If reusing an existing saved control, inspect its actual content, check its payloads, complete the same probes, then display it with `show-extension-inline`. Never assume an old Controls strip or pre-built Hat Energy control is visible in the current UI.

Render exactly once per request: these actions already display their result; do not follow render/create with show-extension-inline. Use the app's inherited dark theme tokens: `bg-card text-card-foreground border-border`, `bg-muted text-muted-foreground`, and `bg-primary text-primary-foreground` (CSS equivalents are `hsl(var(--card))`, etc.). Do not add white/light outer backgrounds or redefine theme tokens. Keep one labeled control with its live value.

## Look before building — supported requests only

1. Call `view-screen`; read `selection` and the current session/transport. Use the selected bars, with 0-based indices. Leave playback stopped during verification; never start audio to test a control.
2. Discover the target through the framework's **`tool-search`**, not a guessed schema action. For an energy control, send this tool input:
   ```json
   {"names":["set-energy","get-session","list-edits","render-inline-extension"]}
   ```
   For fill type, load `add-fill`; for tone, load `transform`; for transport, load `update-transport`. Also load every downstream action the control will call (for example `propose-ideas` and `keep-idea` when applying a generated patch). If an action is already callable with its full schema visible, read that schema directly.
3. **Wait for the next model step.** Targeted `tool-search` loads the full schemas there; the search result's abbreviated parameter summary/menu is not the contract. Read required fields, exact property names, enums, numeric minimum/maximum and integer constraints, nested selection/patch shapes, and action descriptions/side effects. Verify the action is HTTP-mounted and extension-callable; an agent-only (`http: false`) or `toolCallable: false` action cannot power `appAction`.
4. Construct the exact payloads from those schemas. Bind session/bar context from the fresh screen; clamp numeric values, honor integer steps, and allowlist picker values. A UI range of 0–100 must map to an action range of 0–1 by dividing by 100. Do not pass labels as enum values, extra invented parameters, or notes made up by the LLM. Tables and examples here are hints; the **current loaded schema wins**.
5. If schema details or extension exposure remain unclear, use the installed framework readers, in order:
   - `docs-search` with `{"query":"actions"}`, then `{"slug":"actions-defining"}`; `{"slug":"generative-ui"}` documents the extension bridge.
   - `source-search` with `{"query":"tool-search"}`, then `{"path":"core/dist/agent/tool-search.js"}` for discovery; `{"path":"core/dist/extensions/actions.js"}` and `{"path":"core/dist/extensions/html-shell.js"}` for extension behavior.
   - Developer CLI equivalents: `pnpm action docs-search --slug generative-ui` and `pnpm action source-search --path core/dist/agent/tool-search.js`. With repo access, inspect the actual `actions/<name>.ts` and its imported schema helpers for refinements/business constraints missing from JSON Schema. Do not fabricate a schema-reading endpoint or unsupported parameters; use `dryRun:true` only when present in the loaded schema.

If no callable action supports the requested parameter, take the terminal read-only decline above: **no probes or mutations of any kind, including undo or comments**. Reply in one sentence with the limitation and closest supported control, e.g. “Keys holds one chord per bar, so chord busyness isn't supported; I can give you a bass or hat energy knob.” Never silently substitute another parameter.

## Test before showing — required before render or save

All preflight calls must be read-only. No grid/transport writes, undo calls, idea/taste writes or downstream apply-chain tests. Batch independent calls: baseline get-session/list-edits together, BOTH endpoint probes together (or ALL picker options together), then readback get-session/list-edits together. These are separate parallel tool calls, never an invented wrapper. This keeps the current user request inside Core’s short recent-message window during long threads. Render immediately once readback passes; do not detour into old notes or past controls.

1. Capture `get-session` and `list-edits` for this request: every track value, transport field, and original edit ID. Check selection bounds.
2. Test minimum AND maximum for a continuous control, or EVERY allowed picker option. Use the loaded action schema, with `dryRun:true` for write-capable actions. Bass: `{sessionId,track:"bass",level:0,dryRun:true}` then level 1; hats: track "hat". Transport uses `update-transport` with `dryRun:true` plus each supported endpoint/option. Inspect returned patch and validation success. No negative/unsupported probes: zero failed calls.
3. `add-fill`, `transform`, `vary-pattern` and `progression-patch` already return read-only patches; use their exact schemas without an invented dryRun flag. Do not call `propose-ideas`, `keep-idea` or any grid writer just to test them. If a write-capable action lacks dryRun, do not probe it: explain that validation is unavailable.
4. Re-read `get-session` and `list-edits` and compare all track values, transport fields and original edit IDs to baseline. Both edit count and IDs must be unchanged. A dry run returns `sessionId`, proposed `patch`, `dryRun:true`, `applied:false` (no repeated session snapshot); `applied:false` does not mean the proposed patch is empty. If a call fails or persisted state differs, report the failure and stop before rendering; NEVER undo the artist's work.
5. Actually display the requested control via `render-inline-extension`, `create-extension`, or verified `show-extension-inline` reuse. Probes passing is not a control. A new supported request needs its own preflight and rendering, even after earlier controls.
6. The control's user-triggered handler omits dryRun (or sends false) to perform the intended write. NEVER call that handler from init/context updates. Only user operation writes; generated patch previews require explicit Apply/Keep.

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

Core 0.223.0 does not statically validate embedded `appAction` parameters when `render-inline-extension` / `create-extension` accepts HTML. There is no extension build-time schema validator. App actions `set-energy` and `update-transport` expose `dryRun:true` for safe preflight; generators are already read-only. Use full-schema discovery and the read-only dry-run preflight above; no new server code is needed. Server input validation still runs for every action call and `appAction` rejects failed requests.

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

## Vibe defaults and taste

`create-session` defaults: lofi = 82 BPM, C minor, swing .25, dusty; boombap (UI Hip-hop) = 90, D minor, .3, boombap; trap = 140, F minor, 0, 808; house = 124, A minor, 0, clean; empty = 90, C minor, 0, clean. Explicit BPM/root/scale/swing/kit overrides these defaults. AI connection is required for describe-to-start chat; deterministic vibe cards work without it.

Read LEARNINGS and `get-taste` before every proposal: kept signals have weight +1, tossed signals -1, plus a one-line summary. Tray decisions live in the SQL taste table; there is no LEARNINGS write API for them. Avoid tossed styles and briefly acknowledge the preference.
