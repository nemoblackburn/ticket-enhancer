import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, makePrompt } from "./prompt.js";

const PORT = parseInt(process.env.PORT || "7842", 10);
const model = process.env.MODEL || "claude-sonnet-4-5-20250929";
const maxTurns = parseInt(process.env.MAX_TURNS || "50", 10);
const maxBudget = parseFloat(process.env.MAX_BUDGET_USD || "5.00");
const authToken = process.env.AUTH_TOKEN || ""; // empty = no auth (local dev)

// ── MCP Server Configuration ──────────────────────────────────────
// In local mode (default), loads MCP servers from ~/.claude.json via settingSources.
// In remote/deployed mode, reads MCP server URLs from environment variables.
// Set MCP_MODE=remote to use env-based config.

const mcpMode = process.env.MCP_MODE || "local";

function getMcpConfig(): Record<string, unknown> | undefined {
  if (mcpMode === "local") {
    return undefined; // will use settingSources: ["user"] instead
  }

  // Remote mode — build mcpServers from env vars
  const servers: Record<string, { type: string; url: string }> = {};

  if (process.env.MCP_LINEAR_URL) {
    servers["linear-server"] = { type: "http", url: process.env.MCP_LINEAR_URL };
  }
  if (process.env.MCP_NOTION_URL) {
    servers["notion"] = { type: "http", url: process.env.MCP_NOTION_URL };
  }
  if (process.env.MCP_SENTRY_URL) {
    servers["sentry"] = { type: "http", url: process.env.MCP_SENTRY_URL };
  }
  if (process.env.MCP_GRANOLA_URL) {
    servers["granola"] = { type: "http", url: process.env.MCP_GRANOLA_URL };
  }
  if (process.env.MCP_SLACK_URL) {
    servers["slack"] = { type: "http", url: process.env.MCP_SLACK_URL };
  }
  if (process.env.MCP_FIGMA_URL) {
    servers["Figma"] = { type: "http", url: process.env.MCP_FIGMA_URL };
  }
  if (process.env.MCP_METABASE_URL) {
    servers["metabase-server"] = { type: "http", url: process.env.MCP_METABASE_URL };
  }

  if (Object.keys(servers).length === 0) {
    console.warn("⚠️  MCP_MODE=remote but no MCP_*_URL env vars set. No MCP servers will be available.");
  }

  return servers;
}

const mcpServers = getMcpConfig();

// ── Helpers ───────────────────────────────────────────────────────

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!authToken) return true; // no auth configured
  const header = req.headers.authorization;
  if (header === `Bearer ${authToken}`) return true;
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized" }));
  return false;
}

// ── Server ────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (no auth required)
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", model, mcpMode }));
    return;
  }

  // Enhance endpoint — streams SSE
  if (req.method === "POST" && req.url === "/enhance") {
    if (!checkAuth(req, res)) return;

    let body = "";
    for await (const chunk of req) body += chunk;

    let ticketId: string;
    try {
      const parsed = JSON.parse(body);
      ticketId = parsed.ticketId;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON. Expected: { ticketId: \"TAP-123\" }" }));
      return;
    }

    if (!ticketId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing ticketId" }));
      return;
    }

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send("status", { message: `Enhancing ${ticketId}...`, phase: "starting" });

    // Track client disconnect so we can stop early
    let clientDisconnected = false;
    const abortController = new AbortController();

    req.on("close", () => {
      clientDisconnected = true;
      abortController.abort();
    });

    res.on("close", () => {
      clientDisconnected = true;
      abortController.abort();
    });

    try {
      console.log(`[enhance] Starting enhancement for ${ticketId}`);
      console.log(`[enhance] Model: ${model}, MCP servers: ${mcpServers ? Object.keys(mcpServers).join(", ") : "none (local mode)"}`);

      // Build query options — differs between local and remote mode
      const queryOptions: Record<string, unknown> = {
        model,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
        maxBudgetUsd: maxBudget,
        tools: [],
        allowedTools: [
          "mcp__linear-server__*",
          "mcp__granola__*",
          "mcp__slack__*",
          "mcp__sentry__*",
          "mcp__notion__*",
          "mcp__Figma__*",
          "mcp__metabase-server__*",
        ],
        persistSession: false,
        abortController,
      };

      if (mcpServers) {
        // Remote mode — pass MCP servers directly
        queryOptions.mcpServers = mcpServers;
      } else {
        // Local mode — load from ~/.claude.json
        queryOptions.settingSources = ["user"];
      }

      console.log(`[enhance] Calling query() for ${ticketId}...`);
      for await (const message of query({
        prompt: makePrompt(ticketId),
        options: queryOptions as any,
      })) {
        // If client disconnected, stop processing
        if (clientDisconnected) {
          console.log(`Client disconnected, stopping enhancement for ${ticketId}`);
          break;
        }

        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              const connected = message.mcp_servers
                .filter((s: any) => s.status === "connected")
                .map((s: any) => s.name);
              send("status", {
                message: `Connected to: ${connected.join(", ") || "none"}`,
                phase: "connected",
                servers: connected,
              });
            }
            break;

          case "assistant":
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                send("tool", { name: block.name });
              }
              if (block.type === "text" && block.text.trim()) {
                send("text", { content: block.text });
              }
            }
            break;

          case "result":
            if (message.subtype === "success") {
              send("done", {
                cost: message.total_cost_usd,
                turns: message.num_turns,
              });
            } else {
              send("error", {
                error: message.subtype,
                cost: message.total_cost_usd,
                turns: message.num_turns,
              });
            }
            break;
        }
      }
    } catch (err: unknown) {
      if (!clientDisconnected) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        console.error(`[enhance] Error for ${ticketId}:`, errorMessage);
        if (errorStack) console.error(`[enhance] Stack:`, errorStack);
        send("error", { error: errorMessage });
      } else {
        console.log(`[enhance] Enhancement for ${ticketId} aborted (client disconnected)`);
      }
    }

    res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Ticket Enhancer server running on http://localhost:${PORT}`);
  console.log(`Model: ${model} | Max turns: ${maxTurns} | Max budget: $${maxBudget}`);
  console.log(`MCP mode: ${mcpMode}${mcpServers ? ` (${Object.keys(mcpServers).length} servers configured)` : ""}`);
  console.log(`Auth: ${authToken ? "enabled" : "disabled (set AUTH_TOKEN to enable)"}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health   — Health check`);
  console.log(`  POST /enhance  — Enhance a ticket (SSE stream)`);
  console.log(`                   Body: { "ticketId": "TAP-123" }`);
});
