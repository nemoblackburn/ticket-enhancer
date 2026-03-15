import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, makePrompt } from "./prompt.js";

const VERSION = "1.4.0";

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

// ── MCP server status for /health endpoint ───────────────────────
// Probes each configured server at startup and reports status:
//   connected  — server responded (any HTTP status)
//   auth_error — server returned 401/403
//   error      — server unreachable / timed out
//   unknown    — command-based server (can't probe, assumed ok if binary exists)
//   not_found  — command binary missing

type McpServerStatus = {
  name: string;
  status: "connected" | "auth_error" | "error" | "unknown" | "not_found";
  type: "http" | "command" | "unknown";
};

let cachedMcpServers: McpServerStatus[] = [];

async function probeMcpServers(): Promise<McpServerStatus[]> {
  if (mcpMode !== "local") {
    return Object.keys(mcpServers || {}).map((name) => ({
      name,
      status: "unknown" as const,
      type: "http" as const,
    }));
  }

  let claudeConfig: Record<string, any>;
  try {
    const claudeConfigPath = join(homedir(), ".claude.json");
    claudeConfig = JSON.parse(readFileSync(claudeConfigPath, "utf-8"));
  } catch {
    console.warn("[health] Could not read ~/.claude.json — mcpServers will be empty");
    return [];
  }

  const entries = Object.entries(claudeConfig.mcpServers || {}) as [string, any][];
  const results = await Promise.allSettled(
    entries.map(async ([name, cfg]): Promise<McpServerStatus> => {
      if (cfg.type === "http" && cfg.url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const resp = await fetch(cfg.url, {
            method: "OPTIONS",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (resp.status === 401 || resp.status === 403) {
            return { name, status: "auth_error", type: "http" };
          }
          return { name, status: "connected", type: "http" };
        } catch {
          clearTimeout(timeout);
          return { name, status: "error", type: "http" };
        }
      }

      if (cfg.command) {
        try {
          const { existsSync } = await import("node:fs");
          if (existsSync(cfg.command)) {
            return { name, status: "unknown", type: "command" };
          }
        } catch {}
        return { name, status: "not_found", type: "command" };
      }

      return { name, status: "unknown", type: "unknown" };
    })
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { name: "unknown", status: "error" as const, type: "unknown" as const }
  );
}

// Probe runs async at startup; /health serves whatever is resolved so far
const mcpProbePromise = probeMcpServers().then((servers) => {
  cachedMcpServers = servers;
  return servers;
});

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
    res.end(JSON.stringify({
      status: "ok",
      version: VERSION,
      model,
      mcpMode,
      mcpServers: cachedMcpServers,
    }));
    return;
  }

  // Enhance endpoint — streams SSE
  if (req.method === "POST" && req.url === "/enhance") {
    if (!checkAuth(req, res)) return;

    let body = "";
    for await (const chunk of req) body += chunk;

    let ticketId: string;
    let extraInstructions: string | undefined;
    try {
      const parsed = JSON.parse(body);
      ticketId = parsed.ticketId;
      extraInstructions = parsed.extraInstructions || undefined;
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
      const connectedServers = cachedMcpServers
        .filter((s) => s.status === "connected" || s.status === "unknown")
        .map((s) => s.name);
      console.log(`[enhance] Model: ${model}, MCP servers: ${connectedServers.join(", ") || "none"}`);

      // Build query options — differs between local and remote mode
      // Dynamically allow tools from all connected/available MCP servers
      const allowedTools = connectedServers.map((name) => `mcp__${name}__*`);

      const queryOptions: Record<string, unknown> = {
        model,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
        maxBudgetUsd: maxBudget,
        tools: [],
        allowedTools,
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
        prompt: makePrompt(ticketId, extraInstructions),
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

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Ticket Enhancer server running on http://localhost:${PORT}`);
  console.log(`Model: ${model} | Max turns: ${maxTurns} | Max budget: $${maxBudget}`);
  console.log(`Auth: ${authToken ? "enabled" : "disabled (set AUTH_TOKEN to enable)"}`);

  // Wait for MCP probe to finish before printing server list
  console.log(`\nChecking MCP servers...`);
  const servers = await mcpProbePromise;

  const statusIcon: Record<string, string> = {
    connected: "●",   // green in terminal
    auth_error: "▲",  // needs auth
    error: "✕",       // unreachable
    unknown: "○",     // can't verify (command-based)
    not_found: "✕",   // binary missing
  };

  const statusLabel: Record<string, string> = {
    connected: "connected",
    auth_error: "needs auth",
    error: "unreachable",
    unknown: "installed",
    not_found: "not found",
  };

  if (servers.length > 0) {
    console.log(`MCP servers (from ${mcpMode === "local" ? "~/.claude.json" : "environment"}):`);
    for (const s of servers) {
      console.log(`  ${statusIcon[s.status]} ${s.name} — ${statusLabel[s.status]}`);
    }
  } else {
    console.log(`MCP servers: none configured${mcpMode === "local" ? " (check ~/.claude.json)" : ""}`);
  }

  console.log(`\nEndpoints:`);
  console.log(`  GET  /health   — Health check`);
  console.log(`  POST /enhance  — Enhance a ticket (SSE stream)`);
  console.log(`                   Body: { "ticketId": "TAP-123" }`);
});
