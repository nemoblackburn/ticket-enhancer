import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, makePrompt } from "./prompt.js";

const ticketIds = process.argv.slice(2);

if (ticketIds.length === 0) {
  console.error("Usage: npm run batch <TICKET-ID> [TICKET-ID] ...");
  console.error("Example: npm run batch ENG-123 ENG-124 ENG-125");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

const model = process.env.MODEL || "claude-sonnet-4-5-20250929";
const maxTurns = parseInt(process.env.MAX_TURNS || "50", 10);
const maxBudgetPerTicket = parseFloat(process.env.MAX_BUDGET_USD || "5.00");
const concurrency = parseInt(process.env.CONCURRENCY || "1", 10);

console.log(`\nBatch enhancing ${ticketIds.length} tickets`);
console.log(`Model: ${model} | Concurrency: ${concurrency}`);
console.log(`Max turns/ticket: ${maxTurns} | Max budget/ticket: $${maxBudgetPerTicket}`);
console.log("═".repeat(50));

type TicketResult = {
  ticketId: string;
  status: "success" | "error";
  cost: number;
  turns: number;
  error?: string;
};

async function enhanceTicket(ticketId: string): Promise<TicketResult> {
  console.log(`\n▶ Starting: ${ticketId}`);

  try {
    let result: TicketResult = {
      ticketId,
      status: "error",
      cost: 0,
      turns: 0,
    };

    for await (const message of query({
      prompt: makePrompt(ticketId),
      options: {
        model,
        systemPrompt: SYSTEM_PROMPT,
        settingSources: ["user"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
        maxBudgetUsd: maxBudgetPerTicket,
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
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            console.log(`  [${ticketId}] → ${block.name}`);
          }
        }
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          result = {
            ticketId,
            status: "success",
            cost: message.total_cost_usd,
            turns: message.num_turns,
          };
          console.log(
            `✓ ${ticketId} — $${message.total_cost_usd.toFixed(4)}, ${message.num_turns} turns`
          );
        } else {
          result = {
            ticketId,
            status: "error",
            cost: message.total_cost_usd,
            turns: message.num_turns,
            error: message.subtype,
          };
          console.error(`✗ ${ticketId} — ${message.subtype}`);
        }
      }
    }

    return result;
  } catch (err) {
    console.error(`✗ ${ticketId} — ${err}`);
    return { ticketId, status: "error", cost: 0, turns: 0, error: String(err) };
  }
}

// Process tickets with controlled concurrency
async function processBatch(
  tickets: string[],
  concurrency: number
): Promise<TicketResult[]> {
  const results: TicketResult[] = [];
  const queue = [...tickets];

  async function worker() {
    while (queue.length > 0) {
      const ticketId = queue.shift()!;
      const result = await enhanceTicket(ticketId);
      results.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tickets.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

const results = await processBatch(ticketIds, concurrency);

// Summary
console.log("\n" + "═".repeat(50));
console.log("BATCH SUMMARY");
console.log("═".repeat(50));

const succeeded = results.filter((r) => r.status === "success");
const failed = results.filter((r) => r.status === "error");
const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

console.log(`Total: ${results.length} | Success: ${succeeded.length} | Failed: ${failed.length}`);
console.log(`Total cost: $${totalCost.toFixed(4)}`);

if (failed.length > 0) {
  console.log("\nFailed tickets:");
  for (const f of failed) {
    console.log(`  ${f.ticketId}: ${f.error}`);
  }
}
