# Jam Session

An AI bandmate for when you're stuck on a loop. You and the agent edit the same
step-grid: you click beats, it proposes ideas into a tray, and you audition,
keep, or toss them. You stay the artist; it nudges.

Built with [Agent-Native](https://github.com/BuilderIO/agent-native) for the
Builder.io Agent-Native Hackathon (Nov 2026).

## What you can do

- **Play and edit** a looping drum, bass and chord grid (Tone.js, in the browser).
- **Select bars** and hit *Vary · Fill · Simplify · Darker · Brighter* for three
  instant variations, or *Ask bandmate* to have the agent pick.
- **Unstick me**: the agent diagnoses the groove and three bandmates (Drummer,
  Bassist, Keys) each propose one idea.
- **Ask in chat**: "make the last bar build into the drop", "give me a swing
  knob" (the agent renders a live control inline).
- **Taste memory**: what you keep or toss shapes future suggestions.
- **Daily spark**: a 9 AM automation leaves a fresh 2-bar seed in your style.
- **History**: every edit, yours or the agent's, with "revert to here".
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

The grid, variations, tray and history work without AI. Unstick me, Ask
bandmate, chat and the daily spark need a model. Set **one** of these in `.env`:

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
