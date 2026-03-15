import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirror the makePrompt logic from src/prompt.ts for testing
// (prompt.ts is TypeScript; we test the logic directly here)
function makePrompt(ticketId, extraInstructions) {
  let prompt = `Enhance the following Linear ticket by searching for related context across all available tools, then update it with a comprehensive description.

Ticket: ${ticketId}

Please:
1. Read the ticket from Linear
2. Discover what tools you have access to
3. Search all available tools for context: meeting notes, specs, error reports, discussions, and anything else relevant
4. Update the ticket with an enhanced description that is actionable by both humans and AI agents
5. Tell me what you found and what you changed`;

  if (extraInstructions && extraInstructions.trim()) {
    prompt += `

## Additional Context from User
${extraInstructions.trim()}`;
  }

  return prompt;
}

describe("makePrompt", () => {
  it("generates prompt with ticket ID", () => {
    const result = makePrompt("TAP-123");
    assert.ok(result.includes("Ticket: TAP-123"));
    assert.ok(result.includes("Read the ticket from Linear"));
    assert.ok(!result.includes("Additional Context"));
  });

  it("appends extra instructions when provided", () => {
    const result = makePrompt("ENG-42", "Check the #backend channel on Slack");
    assert.ok(result.includes("Ticket: ENG-42"));
    assert.ok(result.includes("## Additional Context from User"));
    assert.ok(result.includes("Check the #backend channel on Slack"));
  });

  it("omits extra instructions section when empty string", () => {
    const result = makePrompt("TAP-1", "");
    assert.ok(!result.includes("Additional Context"));
  });

  it("omits extra instructions section when undefined", () => {
    const result = makePrompt("TAP-1", undefined);
    assert.ok(!result.includes("Additional Context"));
  });

  it("omits extra instructions section when whitespace only", () => {
    const result = makePrompt("TAP-1", "   \n  ");
    assert.ok(!result.includes("Additional Context"));
  });

  it("trims extra instructions", () => {
    const result = makePrompt("TAP-1", "  some tips  \n");
    assert.ok(result.includes("some tips"));
    assert.ok(!result.includes("  some tips  \n"));
  });
});
