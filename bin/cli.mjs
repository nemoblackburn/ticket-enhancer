#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  // Last resort: rely on PATH (npx adds .bin to PATH)
  return "tsx";
}

// ── ASCII banner ─────────────────────────────────────────────────
console.log(`
  ╔══════════════════════════════════════╗
  ║       Ticket Enhancer Server         ║
  ╚══════════════════════════════════════╝
`);

// ── Check for API key ────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("  No ANTHROPIC_API_KEY found in environment.\n");
  const key = await rl.question("  Enter your Anthropic API key: ");
  rl.close();

  if (!key || !key.trim()) {
    console.error("\n  API key is required. Get one at https://console.anthropic.com/\n");
    process.exit(1);
  }

  process.env.ANTHROPIC_API_KEY = key.trim();
  console.log("");
}

// ── Check for MCP servers ────────────────────────────────────────
// In local mode, the server reads from ~/.claude.json automatically.
// Just let the user know.
console.log("  MCP servers will be loaded from your Claude config (~/.claude.json).");
console.log("  Make sure your MCP servers (Linear, Notion, Slack, etc.) are configured there.\n");

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
