# Jam Session

**Every song starts as a sketch.** Jam Session is a phone-first sketchbook for
music ideas, with an AI band in the margins.

Built with [Agent-Native](https://github.com/BuilderIO/agent-native) for the
Builder.io Agent-Native Hackathon (Nov 2026). Demo:
[clips.agent-native.com/share/f0CaSA2SqnOd](https://clips.agent-native.com/share/f0CaSA2SqnOd)

## Why

Most music ideas never make it past the first loop:

- **Too heavy to capture.** Studio software lives on a laptop; the idea arrives on the bus.
- **Too lonely to finish.** Alone, a sketch stalls on the same eight bars.
- **AI takes over.** Today's music AI writes the whole song, and it stops being yours.

Musicians don't want a robot composer. They want a band. Bandmates suggest; the
artist decides.

## What it does

Tap squares to sketch a beat on your phone. Three AI bandmates (Drummer,
Bassist, Keys) sketch ideas next to yours. You **Listen**, **Use it**,
**Tweak** or **Skip**. Nothing changes until you say yes, and that rule is
enforced in code, not just in the prompt.

- **Sketch** one bar per screen, in plain words: Speed, Mood (Sad/Happy), Bounce,
  named chords. Start from Chill, Dance or an empty page.
- **Jam with the band**: the band listens in parallel and each bandmate
  pitches one idea with a before/after preview.
- **Tell the band…**: type what you have in mind ("give me a swing knob"
  renders a live control in chat).
- **Notes on bars**: "needs to build into the drop", and the right bandmate
  replies on the page with an idea for that bar.
- **Tweak before you use**: edit the band's idea on the grid; history records
  "Keys + You".
- **It remembers**: learns your taste from what you use and skip, and a daily
  automation leaves a fresh idea each morning.
- **History**: every edit, yours or the band's, with "revert to here".

## Who it's for

Bedroom producers who get stuck, beginners learning how beats work, and
songwriters who need a groove to write over, without a studio.

## What's next

Hum a rhythm in, export to MIDI/WAV for any studio app, and live jams where
friends and AI bandmates share one sketch.
- **Use it from Claude**: the jam actions are an MCP server, and the grid renders
  inline in Claude as an MCP App.

## How it uses Agent-Native

| Framework feature | In Jam Session |
|---|---|
| `defineAction()` shared actions | Every musical verb (`set-steps`, `vary-pattern`, `propose-ideas`, `keep-idea`…) is one action used by the grid UI, the agent, the CLI and MCP |
| Shared SQL + live sync | The agent's ideas and edits appear on the grid while it loops |
| Context awareness | The agent reads your bar selection, so you never have to describe "which bars" |
| Agent teams + skills | The `unstick` skill runs Drummer, Bassist and Keys as sub-agents |
| Generative UI / Extensions | Knobs on request; the Hat Energy control is a persisted extension |
| Automations + notifications | Daily spark at 9 AM |
| MCP server + MCP Apps | The playable grid inside Claude |
| WebMCP | Play, stop and audition exposed to browser agents |

## Run it yourself

Jam Session runs locally: your machine, your data, your AI key.

**Requirements:** Node.js 22.22+ and pnpm (`npm i -g pnpm`).

```bash
git clone https://github.com/calledAdo/jam-session.git
cd jam-session
pnpm install
cp .env.example .env    # then add your AI provider (below)
pnpm dev                # opens http://localhost:8081
```

Data is stored locally in `data/pglite` (embedded Postgres); nothing leaves your
machine except calls to your AI provider.

### AI provider

The grid, variations, tray and history work without AI. Jam with the band,
Ask bandmate, chat and the daily spark need a model. Set **one** of these in `.env`:

- **Anthropic:** `ANTHROPIC_API_KEY=…`
- **OpenAI:** `OPENAI_API_KEY=…`
- **OpenAI-compatible endpoint** (e.g. a proxy or local server):
  `OPENAI_API_KEY=…`, `OPENAI_BASE_URL=https://…/v1`,
  `AGENT_ENGINE=ai-sdk:openai`, `AGENT_MODEL=<model id>`

You can also pick the model in the app under **Settings**.

### Use it from Claude (optional)

Claude Desktop's **Code** tab and Claude Code can reach your local server
directly:

```bash
npx @agent-native/core@latest connect http://localhost:8081 --client claude-code
```

Then run `/mcp` in Claude Code and choose **Authenticate**. Turn on
**Settings → Labs → App cards in chat apps** in Jam Session so the grid renders
inline. Claude on the web needs a public HTTPS URL instead (for example a
Cloudflare tunnel to a production build: `pnpm build && pnpm start`).

### Telegram (optional)

See [SETUP-telegram.md](SETUP-telegram.md).

## Develop

```bash
pnpm test        # vitest
pnpm typecheck
pnpm agent-native:doctor
```

Layout: `actions/` (shared actions), `server/music/` (pure, tested music
library), `server/sessions/` (data store), `app/components/jam/` (UI),
`.agents/skills/` and `AGENTS.md` (the bandmate's instructions).

## Disclosure

Scaffolded on Oct 27+ from the Agent-Native `chat` template (MIT). Everything
under `actions/` (except the template's `hello`, `navigate`, `view-screen`
scaffolds, which were rewritten), `server/music/`, `server/sessions/`,
`server/db/`, `app/components/jam/`, `app/lib/jam/`, the skills and the Jam
section of `AGENTS.md` is new work for this hackathon.
