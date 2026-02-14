# Ticket Enhancer

**One-click ticket enrichment powered by the Claude Agent SDK and MCP.**

A Chrome extension + server that turns sparse Linear tickets into comprehensive, AI-actionable specs — by pulling context from every tool your team already uses.

https://github.com/user-attachments/assets/placeholder

---

## The Problem

Your AI is only as good as the context it has access to.

Most teams have context scattered across 7+ tools: meeting notes in Notion, decisions in Slack, bugs in Sentry, metrics in Metabase, designs in Figma, transcripts in Granola. When a PM writes a ticket, they're working from memory. When an engineer picks it up, they're doing 30 minutes of archaeology before they can start building.

And when AI agents try to implement those tickets? They hallucinate requirements because the ticket says "add dark mode" with no other context.

**Ticket Enhancer solves this by connecting all your tools through MCP and using Claude to synthesize the full picture — automatically.**

The result: tickets that are detailed enough for both humans and AI agents to execute without asking clarifying questions. What used to take 30 minutes of manual context-gathering now takes 3 minutes and one click.

> Context at scale = velocity that compounds.

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────────┐
│  Chrome Ext  │────▶│   Server    │────▶│  Claude Agent SDK    │
│  (Linear UI) │ SSE │  (Fly.io)   │     │  + MCP Connections   │
└─────────────┘     └─────────────┘     └──────────┬───────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                                ┌───▼───┐   ┌──────▼──┐   ┌───────▼──┐
                                │Linear │   │ Notion  │   │  Slack   │
                                │Sentry │   │ Granola │   │  Figma   │
                                │Metabase│   └─────────┘   └──────────┘
                                └────────┘
```

1. You click **Enhance** on any Linear ticket
2. The server spins up a Claude agent with MCP access to your tools
3. The agent reads the ticket, searches meeting notes, Slack threads, Sentry errors, Notion specs, and more
4. It synthesizes everything into a structured, actionable ticket description
5. It updates the Linear ticket directly — you just watch the progress panel

The Chrome extension streams real-time progress via SSE, showing you exactly which tools the agent is querying with branded icons for each service.

---

## What Gets Enhanced

The agent rewrites tickets into a consistent format:

- **Summary** — Clear 2-3 sentence description of what and why
- **Context** — Decisions from meetings, Slack discussions, and stakeholder input
- **Requirements** — Specific acceptance criteria an AI agent could implement from
- **Technical Notes** — Sentry errors, file paths, API endpoints, architectural context
- **References** — Links to Notion specs, Slack threads, Sentry issues (not copied content — just links)

Tickets become consumable by both humans reviewing them and AI coding agents implementing them.

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- An [Anthropic API key](https://console.anthropic.com/)
- [Claude Desktop](https://claude.ai/download) or [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with MCP servers configured
- Chrome or Chromium browser

### 1. Clone and install

```bash
git clone https://github.com/nemoblackburn/ticket-enhancer.git
cd ticket-enhancer
npm install
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. Configure MCP servers

**For local development**, the server reads MCP config from your Claude Desktop / Claude Code settings (`~/.claude.json`). Make sure you have the MCP servers you want connected there (Linear, Notion, Slack, Sentry, etc.).

**For remote deployment** (Fly.io), set `MCP_MODE=remote` and provide individual MCP server URLs as environment variables. See [Deploying to Fly.io](#deploying-to-flyio) below.

### 3. Start the server

```bash
npm run serve
```

The server runs at `http://localhost:7842` by default.

### 4. Install the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder
4. Click the extension icon → set **Server URL** to `http://localhost:7842`
5. Leave Auth Token empty for local dev

### 5. Enhance a ticket

1. Open any ticket on [linear.app](https://linear.app)
2. Click the **✦ Enhance** button that appears in the ticket header
3. Watch the progress panel as the agent pulls context from your tools
4. The ticket description gets updated automatically

---

## CLI Usage

You can also enhance tickets from the command line without the Chrome extension:

```bash
# Single ticket
npm run enhance ENG-123

# Batch — multiple tickets at once
npm run batch ENG-123 ENG-124 ENG-125

# Batch with concurrency
CONCURRENCY=3 npm run batch ENG-123 ENG-124 ENG-125 ENG-126 ENG-127
```

---

## Configuration

All configuration is via environment variables (`.env` file for local dev):

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key |
| `MODEL` | `claude-sonnet-4-5-20250929` | Claude model to use |
| `MAX_TURNS` | `50` | Max agent conversation turns per ticket |
| `MAX_BUDGET_USD` | `5.00` | Max spend per ticket enhancement |
| `AUTH_TOKEN` | — | Bearer token for the `/enhance` endpoint |
| `MCP_MODE` | `local` | `local` (reads ~/.claude.json) or `remote` (reads env vars) |
| `CONCURRENCY` | `1` | Batch mode: how many tickets to process in parallel |

When `MCP_MODE=remote`, also set:

| Variable | Description |
|----------|-------------|
| `MCP_LINEAR_URL` | Linear MCP endpoint |
| `MCP_NOTION_URL` | Notion MCP endpoint |
| `MCP_SENTRY_URL` | Sentry MCP endpoint |
| `MCP_GRANOLA_URL` | Granola MCP endpoint |
| `MCP_SLACK_URL` | Slack MCP endpoint |
| `MCP_FIGMA_URL` | Figma MCP endpoint |
| `MCP_METABASE_URL` | Metabase MCP endpoint |

---

## Deploying to Fly.io

The server is Docker-ready and configured for Fly.io:

```bash
# Install Fly CLI if you haven't
brew install flyctl

# Launch (first time)
fly launch

# Set secrets
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
fly secrets set AUTH_TOKEN=your-secret-token
fly secrets set MCP_LINEAR_URL=https://mcp.linear.app/mcp
fly secrets set MCP_NOTION_URL=https://mcp.notion.com/mcp
fly secrets set MCP_SENTRY_URL=https://mcp.sentry.dev/mcp
fly secrets set MCP_GRANOLA_URL=https://mcp.granola.ai/mcp
# ... add any other MCP server URLs

# Deploy
fly deploy
```

Then update the Chrome extension settings to point at your Fly.io URL (`https://your-app.fly.dev`) and set the auth token.

> **Note:** The Dockerfile runs as a non-root user. This is required — the Claude Agent SDK refuses to run with `--dangerously-skip-permissions` as root for security reasons.

---

## Project Structure

```
ticket-enhancer/
├── src/
│   ├── server.ts      # HTTP server with SSE streaming (/enhance endpoint)
│   ├── enhance.ts     # CLI: enhance a single ticket
│   ├── batch.ts       # CLI: enhance multiple tickets with concurrency
│   └── prompt.ts      # System prompt and ticket enhancement instructions
├── extension/
│   ├── manifest.json   # Chrome extension manifest (Manifest V3)
│   ├── content.js      # Injected into Linear — button + progress panel
│   ├── styles.css      # Extension UI styles
│   ├── options.html/js # Extension settings (server URL + auth token)
│   └── icon*.png       # Extension icons
├── Dockerfile          # Production container (non-root user)
├── fly.toml            # Fly.io deployment config
└── .env.example        # All configuration options documented
```

---

## Supported MCP Connections

| Service | What it pulls |
|---------|--------------|
| **Linear** | Ticket details, comments, labels, project context |
| **Notion** | Meeting notes, PRDs, specs, technical docs |
| **Granola** | Meeting transcripts and discussion context |
| **Slack** | Thread discussions, decisions, announcements |
| **Sentry** | Error reports, stack traces, bug context |
| **Figma** | Design context and component references |
| **Metabase** | Metrics, saved queries, dashboard data |

The agent prioritizes meeting notes (Notion → Granola) as the richest source of decisions and context, then cross-references other tools based on what the ticket needs.

---

## Why I Built This

I lead product at a startup where velocity matters. We were already using Claude Code and Cursor across the engineering team, but the outputs were inconsistent — because the inputs (tickets) were inconsistent.

The insight was simple: **optimizing for AI means accelerating your team.** When tickets have rich context, AI executes perfectly. When they don't, everyone — human and AI — wastes time asking clarifying questions.

So I built a context machine. One interface, all company knowledge, accessible via MCP. PMs write useful tickets in 3 minutes instead of 30. Engineers understand the full "why" without Slack archaeology. New hires onboard in hours by chatting with an LLM about past strategy and metrics.

Every ticket enriched makes future ones discoverable. Context at scale is velocity that compounds.

*[Original thread on X](https://x.com/nemoblackburn/status/2011838393223926123)*

---

## License

MIT
