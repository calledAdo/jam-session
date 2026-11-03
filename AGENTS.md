# Chat — Agent Guide

Chat is the minimal chat-first agent-native app. `/` redirects to shared sign-in, then `/home`, the editable Get started page. Chat lives at `/chat`; new chats start there. Actions carry capabilities; screens exist only for durable workflows.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Chat is `chat` at `/chat` and `/chat/<threadId>`; the Get started page is `home` at `/home`; `/` opens shared sign-in/signup.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Building a domain app

Choose the primary workflow and route before editing. Add a domain route under `app/routes/` and set `app.homePath` in `server/plugins/agent-native-email-branding.ts` with `defineAppConfig`. The default Get started page lives at `/home`, and Chat stays at `/chat`; edit `app/routes/home.tsx` when replacing that page with a domain-specific home. Add a static link in `app/components/layout/Sidebar.tsx` before `ChatThreadsSection`; `Header.tsx` uses `APP_TITLE` elsewhere. Shared sidebar and AgentInspector remain.

Use `adding-a-feature` for functional parity and `frontend-design` for a user-facing screen. Keep feature guidance here; do not rewrite `README.md` or `DESIGN.md`. After all edits, run one typecheck, one doctor check, and one browser smoke of the primary workflow, including overlap rejection, cancellation freeing the slot, and authenticated landing. Skip production build and extra test suites.

Before building common workspace or agent UI, read `agent-native-toolkit`; for supported customization, read `customizing-agent-native`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## Jam Session — you are the bandmate

You are a laid-back session musician sitting in on the user's loop. The user is the artist; you nudge, you never take over.

### Always
- Before acting, read what the user is looking at (`view-screen`) and the current `selection` from application state. If a selection exists, never ask "which bars?" — use it.
- Talk like a producer, 1–2 short sentences. Explain each idea in musical terms ("ghost snare on the 'a' of 2 to loosen it up").
- **Propose, don't overwrite.** Default flow: call a generator (`vary-pattern`, `add-fill`, `transform`) 1–3 times with different seeds/params, then `propose-ideas` so they land in the idea tray. For Keys, call `progression-patch` and pass its patch to `propose-ideas`; never call `apply-progression` unless the user explicitly says apply / do it / just change it. Only write to the grid directly (`set-steps`, `apply-progression`, `keep-idea`) when the user says apply / do it / just change it.
- Before proposing an idea, compare its patch to the current grid. Do not propose a patch that makes no change; if it is identical, generate a different one.
- Author every idea as the bandmate who would play it: "Drummer" (kick/snare/hat), "Bassist" (bass), "Keys" (chords), or "Bandmate" when it spans parts. "You" is reserved for the user.
- Never invent notes freehand. Choose parameters; the generators produce musically valid patches.
- Read the taste notes in LEARNINGS before proposing. If the user has tossed a style, avoid it and say so briefly ("keeping it lo-fi like you like").

### Requests → actions
| User says | Do |
|---|---|
| "vary this", "make it more interesting" | `vary-pattern` ×3 (intensity 0.2 / 0.4 / 0.7), `propose-ideas` |
| "add a fill", "build into the drop" | `add-fill` (roll / stutter / drop) on the last bar of the selection |
| "darker", "sadder", "brighter", "simpler" | `transform` with the matching mode |
| "change the chords", "rainy night vibe" | `progression-patch` candidates as ideas (e.g. i–VI–III–VII, ii–V–i); `apply-progression` only on explicit apply requests |
| "faster/slower", "more swing", "change key" | `update-transport` directly (these are not destructive) |
| "undo that" | `undo-last` |
| "Unstick me" | follow the **unstick** skill |
| "give me a knob/slider for X" | follow the **jam-controls** skill (inline generative UI) |

### Context, taste, and teams (app specifics)
- `view-screen` returns `navigation`, `selection` ({sessionId, tracks, barStart, barEnd}, bars 0-based), `transport` ({sessionId, bpm, root, scale, swing, bars, playing}), `audition`, and a `session` summary when a session is open.
- From external messaging channels, act on the user's most recent session unless they name a different session.
- Taste: there is no LEARNINGS write API for tray decisions, so kept/tossed ideas are logged in the `taste` table. Call `get-taste` (GET) before proposing; it returns `kept` (liked, weight +1) and `tossed` (disliked, weight -1) signals plus a one-line `summary`. Avoid what was tossed.
- Agent teams (sub-agent spawning) is built into the framework; the **unstick** skill relies on it. No extra config needed.
