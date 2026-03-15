#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import * as readline from "node:readline/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "src", "server.ts");

// Find tsx binary — npx may hoist node_modules, so try multiple locations
function findTsx() {
  const candidates = [
    join(__dirname, "..", "node_modules", ".bin", "tsx"),  // standard
    join(__dirname, "..", "..", ".bin", "tsx"),             // hoisted by npx
  ];
  const found = candidates.find((p) => existsSync(p));
  if (found) return found;
  return "tsx";
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const purple = (s) => `\x1b[38;5;141m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// ── ASCII banner ─────────────────────────────────────────────────
console.log(`
  ${purple(`████████╗██╗ ██████╗██╗  ██╗███████╗████████╗`)}
  ${purple(`╚══██╔══╝██║██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝`)}
  ${purple(`   ██║   ██║██║     █████╔╝ █████╗     ██║`)}
  ${purple(`   ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║`)}
  ${purple(`   ██║   ██║╚██████╗██║  ██╗███████╗   ██║`)}
  ${purple(`   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝`)}
  ${dim(`  ███████╗███╗   ██╗██╗  ██╗ █████╗ ███╗   ██╗ ██████╗███████╗██████╗`)}
  ${dim(`  ██╔════╝████╗  ██║██║  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝██╔══██╗`)}
  ${dim(`  █████╗  ██╔██╗ ██║███████║███████║██╔██╗ ██║██║     █████╗  ██████╔╝`)}
  ${dim(`  ██╔══╝  ██║╚██╗██║██╔══██║██╔══██║██║╚██╗██║██║     ██╔══╝  ██╔══██╗`)}
  ${dim(`  ███████╗██║ ╚████║██║  ██║██║  ██║██║ ╚████║╚██████╗███████╗██║  ██║`)}
  ${dim(`  ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝`)}

  ${dim(`Enhance your Linear tickets with context from all your tools.`)}
`);

// ── Multi-step onboarding ────────────────────────────────────────
// Auto-detect what's already set up, only ask when something is missing.

const claudeConfigPath = join(homedir(), ".claude.json");
const hasClaudeCode = existsSync(claudeConfigPath);

let hasMcpServers = false;
let mcpServerNames = [];
if (hasClaudeCode) {
  try {
    const config = JSON.parse(readFileSync(claudeConfigPath, "utf-8"));
    mcpServerNames = Object.keys(config.mcpServers || {});
    hasMcpServers = mcpServerNames.length > 0;
  } catch {}
}

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

// Only show setup flow if something is missing
if (!hasClaudeCode || !hasMcpServers || !hasApiKey) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`  ${bold("Setup")}\n`);
  console.log(dim(`  Ticket Enhancer uses Claude Code's MCP servers to pull context`));
  console.log(dim(`  from your tools (Linear, Notion, Slack, Sentry, etc.).\n`));

  // ── Step 1: Claude Code ──────────────────────────────────────
  if (hasClaudeCode) {
    console.log(`  ${green("✓")} Claude Code ${dim("— ~/.claude.json found")}`);
  } else {
    console.log(`  ${yellow("✗")} ${bold("Claude Code not found")}\n`);
    console.log(dim(`     Ticket Enhancer uses Claude Code's MCP servers to pull context.`));
    console.log(dim(`     Install Claude Code first, then run this again.\n`));
    console.log(`     ${dim("→")} https://docs.anthropic.com/en/docs/claude-code\n`);
    await rl.question(`  ${purple(">")} Press ENTER to open in the browser... `);
    const { exec } = await import("node:child_process");
    exec("open https://docs.anthropic.com/en/docs/claude-code");
    console.log(dim(`\n     After installing, run ${bold("npx ticket-enhancer")} again.\n`));
    rl.close();
    process.exit(0);
  }

  // ── Step 2: MCP Servers ──────────────────────────────────────
  if (hasMcpServers) {
    console.log(`  ${green("✓")} MCP servers ${dim(`— ${mcpServerNames.length} configured (${mcpServerNames.join(", ")})`)}`);
  } else {
    console.log(`  ${yellow("✗")} ${bold("No MCP servers found")}\n`);
    console.log(dim(`     Add servers like Linear, Notion, Slack, or Sentry to Claude Code.`));
    console.log(dim(`     Run ${bold("/mcp")} in Claude Code to manage your MCP servers,`));
    console.log(dim(`     then run this again.\n`));
    rl.close();
    process.exit(0);
  }

  // ── Step 3: API Key ──────────────────────────────────────────
  if (hasApiKey) {
    console.log(`  ${green("✓")} Anthropic API key ${dim("— set in environment")}`);
  } else {
    console.log(`\n  ${yellow("✗")} ${bold("Anthropic API Key")}\n`);
    console.log(dim(`     The AI agent needs an Anthropic API key to run.`));
    console.log(`     ${dim("→")} ${dim("https://console.anthropic.com/")}\n`);

    const answer = await rl.question(`  ${purple(">")} Do you have an API key? ${dim("(Y/n)")} `);
    if (answer.trim().toLowerCase() === "n") {
      console.log(`\n  ${dim("Create an API key, then run this again.")}`);
      console.log(`  ${dim("→ https://console.anthropic.com/")}\n`);
      rl.close();
      process.exit(0);
    }

    const key = await rl.question(`  ${purple(">")} Paste your API key: `);
    if (!key || !key.trim()) {
      console.error(`\n  API key is required.\n`);
      rl.close();
      process.exit(1);
    }

    process.env.ANTHROPIC_API_KEY = key.trim();
    console.log(`  ${green("✓")} API key saved for this session.`);
  }

  rl.close();
  console.log(`\n  ${green("All set!")} Starting server...\n`);
} else {
  // Everything auto-detected — show quick summary
  console.log(`  ${green("✓")} Claude Code  ${green("✓")} ${mcpServerNames.length} MCP servers  ${green("✓")} API key`);
  console.log("");
}

// ── Start the server ─────────────────────────────────────────────
const tsxBin = findTsx();

const child = spawn(tsxBin, [serverPath], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error("  Could not find tsx. Try: npm install");
  } else {
    console.error(`  Failed to start server: ${err.message}`);
  }
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

// Forward signals for clean shutdown
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
