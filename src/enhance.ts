import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, makePrompt } from "./prompt.js";

const ticketId = process.argv[2];

if (!ticketId) {
  console.error("Usage: npm run enhance <TICKET-ID>");
  console.error("Example: npm run enhance ENG-123");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  console.error("Set it with: export ANTHROPIC_API_KEY=your-key");
  process.exit(1);
}

const model = process.env.MODEL || "claude-sonnet-4-5-20250929";
const maxTurns = parseInt(process.env.MAX_TURNS || "50", 10);
const maxBudget = parseFloat(process.env.MAX_BUDGET_USD || "5.00");

console.log(`\nEnhancing ticket: ${ticketId}`);
console.log(`Model: ${model}`);
console.log(`Max turns: ${maxTurns} | Max budget: $${maxBudget}`);
console.log("─".repeat(50));

for await (const message of query({
  prompt: makePrompt(ticketId),
  options: {
    model,
    systemPrompt: SYSTEM_PROMPT,
    // Inherit MCP servers from your Claude Code user settings
    settingSources: ["user"],
    // Auto-allow all MCP tool calls (no interactive prompts)
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns,
    maxBudgetUsd: maxBudget,
    // Don't need file tools — only MCP tools
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
    // No session persistence needed for one-shot enhancement
    persistSession: false,
  },
})) {
  switch (message.type) {
    case "system":
      if (message.subtype === "init") {
        const connected = message.mcp_servers.filter(
          (s) => s.status === "connected"
        );
        const failed = message.mcp_servers.filter(
          (s) => s.status !== "connected"
        );
        console.log(
          `\nMCP servers connected: ${connected.map((s) => s.name).join(", ") || "none"}`
        );
        if (failed.length > 0) {
          console.warn(
            `MCP servers failed: ${failed.map((s) => `${s.name} (${s.status})`).join(", ")}`
          );
        }
        console.log("");
      }
      break;

    case "assistant":
      // Log tool calls so you can see what the agent is doing
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          console.log(`  → ${block.name}`);
        }
        if (block.type === "text" && block.text.trim()) {
          console.log(`\n${block.text}`);
        }
      }
      break;

    case "result":
      console.log("\n" + "─".repeat(50));
      if (message.subtype === "success") {
        console.log(`Done! Cost: $${message.total_cost_usd.toFixed(4)} | Turns: ${message.num_turns}`);
      } else {
        console.error(`Error: ${message.subtype}`);
        if ("errors" in message) {
          for (const err of message.errors) {
            console.error(`  ${err}`);
          }
        }
        console.log(`Cost: $${message.total_cost_usd.toFixed(4)} | Turns: ${message.num_turns}`);
      }
      break;
  }
}
