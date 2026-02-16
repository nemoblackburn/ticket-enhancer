# Privacy Policy

**Ticket Enhancer**
Last updated: February 16, 2025

## What This Extension Does

Ticket Enhancer is a Chrome extension that adds an "Enhance" button to Linear (linear.app) ticket pages. When clicked, it sends the ticket ID to a server you configure, which uses AI to enrich the ticket with context from your connected tools.

## Data Collection

Ticket Enhancer does **not** collect, store, or transmit any personal data to third parties.

### What the extension stores locally

- **Server URL**: The URL of your Ticket Enhancer server (stored in Chrome sync storage)
- **Auth Token**: A bearer token for authenticating with your server (stored in Chrome sync storage)

This data never leaves your browser except to communicate with the server URL you configure.

### What the extension sends to your server

When you click "Enhance" on a ticket, the extension sends:

- The **ticket ID** (e.g., "ENG-123") extracted from the current Linear page URL

That's it. No cookies, no browsing history, no personal information.

### What the server does

The server you configure (either self-hosted or deployed to your own Fly.io account) uses the ticket ID to:

1. Read the ticket from Linear via MCP
2. Search for related context in your connected tools (Notion, Slack, Sentry, Granola, Figma, Metabase)
3. Update the ticket description in Linear

All MCP connections are authenticated with your own credentials. The server does not store any ticket data after the enhancement is complete.

## Third-Party Services

The server communicates with:

- **Anthropic API**: To run the Claude AI agent. Subject to [Anthropic's privacy policy](https://www.anthropic.com/privacy).
- **MCP servers**: Whatever tools you choose to connect (Linear, Notion, Slack, etc.). Each is subject to its own privacy policy and authenticated with your own accounts.

No data is sent to any service you have not explicitly configured.

## Data Retention

The extension stores your settings (server URL, auth token) in Chrome sync storage until you remove them. No other data is retained.

The server does not persist any ticket data, conversation logs, or user information.

## Your Control

- You choose which server to connect to
- You choose which MCP tools to enable
- You can disconnect at any time by removing the extension or clearing its settings
- All server infrastructure is self-hosted under your control

## Open Source

This project is fully open source. You can audit the complete source code at [github.com/nemoblackburn/ticket-enhancer](https://github.com/nemoblackburn/ticket-enhancer).

## Contact

For questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/nemoblackburn/ticket-enhancer/issues).
