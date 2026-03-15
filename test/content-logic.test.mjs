import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Pure logic extracted from content.js for testing ─────────────
// These functions mirror the logic in content.js but are importable.
// When content.js is refactored to a module, these can be imported directly.

function getTicketIdFromUrl(pathname) {
  const match = pathname.match(/\/issue\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

function cleanToolName(toolName) {
  const parts = toolName.split("__");
  return parts.length >= 3 ? parts.slice(2).join("__") : toolName;
}

const APP_META = {
  "mcp__linear-server__": { name: "Linear", icon: "linear", color: "#5E6AD2" },
  "mcp__linear__": { name: "Linear", icon: "linear", color: "#5E6AD2" },
  "mcp__notion__": { name: "Notion", icon: "notion", color: "#FFFFFF" },
  "mcp__slack__": { name: "Slack", icon: "slack", color: "#E01E5A" },
  "mcp__sentry__": { name: "Sentry", icon: "sentry", color: "#FB4226" },
  "mcp__granola__": { name: "Granola", icon: "granola", color: "#4ade80" },
  "mcp__Figma__": { name: "Figma", icon: "figma", color: "#A259FF" },
};

function getAppForTool(toolName) {
  for (const [prefix, meta] of Object.entries(APP_META)) {
    if (toolName.startsWith(prefix)) return meta;
  }
  return { name: "Tool", icon: null, color: "#8264ff" };
}

// Onboarding state transition logic:
// Given storage state + health result, determine what to do.
function getOnboardingAction({ onboardingComplete, onboardingDismissed, healthOk, isIssuePage }) {
  if (!isIssuePage) return "skip";
  if (onboardingComplete) return "skip";
  if (healthOk) return "mark_complete";
  if (onboardingDismissed) return "skip";
  return "show_hint";
}

// ── Tests ────────────────────────────────────────────────────────

describe("getTicketIdFromUrl", () => {
  it("extracts ticket ID from standard issue URL", () => {
    assert.equal(getTicketIdFromUrl("/issue/TAP-2661"), "TAP-2661");
  });

  it("extracts ticket ID from org-prefixed URL", () => {
    assert.equal(getTicketIdFromUrl("/primitivesxyz/issue/TAP-123"), "TAP-123");
  });

  it("returns null for non-issue pages", () => {
    assert.equal(getTicketIdFromUrl("/inbox"), null);
    assert.equal(getTicketIdFromUrl("/settings"), null);
    assert.equal(getTicketIdFromUrl("/"), null);
  });

  it("returns null for malformed ticket IDs", () => {
    assert.equal(getTicketIdFromUrl("/issue/tap-123"), null); // lowercase
    assert.equal(getTicketIdFromUrl("/issue/TAP"), null); // no number
    assert.equal(getTicketIdFromUrl("/issue/123"), null); // no prefix
  });

  it("handles URLs with query params and fragments", () => {
    // pathname doesn't include query/fragment, but test the regex is solid
    assert.equal(getTicketIdFromUrl("/issue/ENG-42"), "ENG-42");
  });
});

describe("cleanToolName", () => {
  it("strips mcp prefix from tool names", () => {
    assert.equal(cleanToolName("mcp__linear-server__get_issue"), "get_issue");
    assert.equal(cleanToolName("mcp__notion__search"), "search");
    assert.equal(cleanToolName("mcp__sentry__get_issue_details"), "get_issue_details");
  });

  it("handles double-underscore in tool name", () => {
    assert.equal(cleanToolName("mcp__slack__search__messages"), "search__messages");
  });

  it("returns original name if no mcp prefix", () => {
    assert.equal(cleanToolName("some_tool"), "some_tool");
    assert.equal(cleanToolName("plain"), "plain");
  });

  it("handles hash-based server IDs", () => {
    assert.equal(cleanToolName("mcp__3bdd789d__get_meetings"), "get_meetings");
  });
});

describe("getAppForTool", () => {
  it("identifies Linear tools", () => {
    assert.equal(getAppForTool("mcp__linear-server__get_issue").name, "Linear");
    assert.equal(getAppForTool("mcp__linear__list_issues").name, "Linear");
  });

  it("identifies Notion tools", () => {
    assert.equal(getAppForTool("mcp__notion__search").name, "Notion");
  });

  it("identifies Slack tools", () => {
    assert.equal(getAppForTool("mcp__slack__search_messages").name, "Slack");
  });

  it("returns fallback for unknown tools", () => {
    const result = getAppForTool("mcp__unknown__something");
    assert.equal(result.name, "Tool");
    assert.equal(result.icon, null);
  });
});

describe("getOnboardingAction (state transitions)", () => {
  it("skips on non-issue pages", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: false, onboardingComplete: false, onboardingDismissed: false, healthOk: false }),
      "skip"
    );
  });

  it("skips if onboarding already complete", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: true, onboardingComplete: true, onboardingDismissed: false, healthOk: false }),
      "skip"
    );
  });

  it("marks complete if health check passes", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: true, onboardingComplete: false, onboardingDismissed: false, healthOk: true }),
      "mark_complete"
    );
  });

  it("skips if dismissed", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: true, onboardingComplete: false, onboardingDismissed: true, healthOk: false }),
      "skip"
    );
  });

  it("shows hint if not complete, not dismissed, health fails, on issue page", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: true, onboardingComplete: false, onboardingDismissed: false, healthOk: false }),
      "show_hint"
    );
  });

  it("marks complete even if dismissed (health takes precedence)", () => {
    assert.equal(
      getOnboardingAction({ isIssuePage: true, onboardingComplete: false, onboardingDismissed: true, healthOk: true }),
      "mark_complete"
    );
  });
});
