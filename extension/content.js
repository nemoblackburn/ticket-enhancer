// Ticket Enhancer — Content Script for Linear
// Injects an "Enhance" button on Linear issue pages

// Default server URL — overridden by extension settings
let SERVER_URL = "http://localhost:7842";
let AUTH_TOKEN = "";

// Load saved settings from chrome.storage
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.sync.get(["serverUrl", "authToken"], (result) => {
    if (result.serverUrl) SERVER_URL = result.serverUrl.replace(/\/+$/, "");
    if (result.authToken) AUTH_TOKEN = result.authToken;
  });
}

let currentTicketId = null;
let enhanceBtn = null;
let panel = null;
let currentAbortController = null;
let isEnhancing = false;

// MCP app logo SVGs (inline for content script — no external requests)
const APP_ICONS = {
  linear: `<svg viewBox="0 0 24 24" fill="none"><path d="M2.51 12.965l8.524 8.525a9.916 9.916 0 0 1-8.524-8.525zm1.158-2.86l11.237 11.238a10.07 10.07 0 0 1-2.463 1.082L2.074 12.058a10.065 10.065 0 0 1 1.593-1.953zm2.467-2.09L17.897 19.78a10.07 10.07 0 0 1-1.765 1.396L4.37 9.41a10.07 10.07 0 0 1 1.765-1.396zM12 1.934c5.522 0 10 4.477 10 10a9.963 9.963 0 0 1-2.14 6.167L8.033 6.274A9.963 9.963 0 0 1 12 1.934z" fill="currentColor"/></svg>`,
  notion: `<svg viewBox="0 0 24 24" fill="none"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.29 2.35c-.42-.326-.98-.7-2.055-.607L3.34 2.97c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.84c-.56.047-.747.327-.747.98zm14.337.7c.093.42 0 .84-.42.886l-.7.14v10.264c-.606.327-1.166.514-1.633.514-.746 0-.933-.234-1.493-.934l-4.571-7.183v6.953l1.446.327s0 .84-1.166.84l-3.22.187c-.093-.187 0-.653.327-.727l.84-.233V8.89L7.478 8.75c-.093-.42.14-1.026.793-1.073l3.453-.233 4.758 7.276v-6.44l-1.213-.14c-.094-.514.28-.887.746-.92z" fill="currentColor"/></svg>`,
  slack: `<svg viewBox="0 0 24 24" fill="none"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52zm1.268 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.831 24a2.528 2.528 0 0 1-2.52-2.522zM8.831 5.042a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.83 0a2.528 2.528 0 0 1 2.521 2.522v2.52zm0 1.268a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.52 2.521H2.522A2.528 2.528 0 0 1 0 8.831a2.528 2.528 0 0 1 2.522-2.52zM18.956 8.831a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.831a2.528 2.528 0 0 1-2.522 2.521h-2.522zm-1.268 0a2.528 2.528 0 0 1-2.52 2.521 2.527 2.527 0 0 1-2.521-2.52V2.522A2.527 2.527 0 0 1 15.168 0a2.528 2.528 0 0 1 2.52 2.522zM15.168 18.956a2.528 2.528 0 0 1 2.52 2.522A2.528 2.528 0 0 1 15.168 24a2.527 2.527 0 0 1-2.521-2.522v-2.522zm0-1.268a2.527 2.527 0 0 1-2.521-2.52 2.527 2.527 0 0 1 2.52-2.521h6.314A2.528 2.528 0 0 1 24 15.168a2.528 2.528 0 0 1-2.522 2.52z" fill="currentColor"/></svg>`,
  sentry: `<svg viewBox="0 0 24 24" fill="none"><path d="M13.91 2.505c-.873-1.553-3.068-1.553-3.94 0L7.791 6.3a10.17 10.17 0 0 1 4.193 3.18l1.467-2.56a1.091 1.091 0 0 1 1.897 0l5.63 9.83H18.18a8.138 8.138 0 0 0-.483-4.075l1.614-2.813a10.2 10.2 0 0 1 1.77 7.748h2.835a1.09 1.09 0 0 0 .949-1.637zM6.19 18.752H2.084a1.09 1.09 0 0 1-.948-1.638l1.17-2.045a5.104 5.104 0 0 1 3.413 3.683zm.793-5.17a7.144 7.144 0 0 0-4.622 4.311L1.19 20.14c-.873 1.552.218 3.495 1.97 3.495H7.4a7.124 7.124 0 0 0-.417-6.052z" fill="currentColor"/></svg>`,
  granola: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  figma: `<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 2h3v6.5h-3a3.25 3.25 0 1 1 0-6.5zM8.5 9.5h3V16h-3a3.25 3.25 0 1 1 0-6.5zM8.5 17h3v3.25a3.25 3.25 0 1 1-3-3.25zM12.5 2h3a3.25 3.25 0 1 1 0 6.5h-3zM12.5 9.5h3.25a3.25 3.25 0 1 1 0 6.5H12.5z" fill="currentColor"/></svg>`,
  metabase: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor"/></svg>`,
};

// Map MCP tool prefixes to app names and display colors
const APP_META = {
  "mcp__linear-server__":   { name: "Linear",   icon: "linear",   color: "#5E6AD2" },
  "mcp__linear__":          { name: "Linear",   icon: "linear",   color: "#5E6AD2" },
  "mcp__notion__":          { name: "Notion",   icon: "notion",   color: "#FFFFFF" },
  "mcp__slack__":           { name: "Slack",    icon: "slack",    color: "#E01E5A" },
  "mcp__sentry__":          { name: "Sentry",   icon: "sentry",   color: "#FB4226" },
  "mcp__granola__":         { name: "Granola",  icon: "granola",  color: "#4ade80" },
  "mcp__3bdd789d":          { name: "Granola",  icon: "granola",  color: "#4ade80" },
  "mcp__Figma__":           { name: "Figma",    icon: "figma",    color: "#A259FF" },
  "mcp__6247b4ca":          { name: "Figma",    icon: "figma",    color: "#A259FF" },
  "mcp__metabase-server__": { name: "Metabase", icon: "metabase", color: "#509EE3" },
  "mcp__metabase__":        { name: "Metabase", icon: "metabase", color: "#509EE3" },
  "mcp__aa2ed65a":          { name: "Sentry",   icon: "sentry",   color: "#FB4226" },
  "mcp__ff976d04":          { name: "Slack",    icon: "slack",    color: "#E01E5A" },
  "mcp__ffaf5738":          { name: "Notion",   icon: "notion",   color: "#FFFFFF" },
  "mcp__b2139628":          { name: "Linear",   icon: "linear",   color: "#5E6AD2" },
};

function getAppForTool(toolName) {
  for (const [prefix, meta] of Object.entries(APP_META)) {
    if (toolName.startsWith(prefix)) return meta;
  }
  return { name: "Tool", icon: null, color: "#8264ff" };
}

// Strip the mcp prefix to get a cleaner tool name
function cleanToolName(toolName) {
  // e.g. "mcp__linear-server__get_issue" → "get_issue"
  const parts = toolName.split("__");
  return parts.length >= 3 ? parts.slice(2).join("__") : toolName;
}

// Extract ticket ID from the URL (e.g., /issue/TAP-2661 or /primitivesxyz/issue/TAP-2661)
function getTicketIdFromUrl() {
  const match = window.location.pathname.match(/\/issue\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

// Build fetch headers — includes auth if configured
function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

// Create the Enhance button
function createButton() {
  const btn = document.createElement("button");
  btn.className = "te-enhance-btn";
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Enhance`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    onEnhanceClick();
  });
  return btn;
}

// Create progress panel
function createPanel(ticketId) {
  if (panel) panel.remove();

  const el = document.createElement("div");
  el.className = "te-panel";
  el.innerHTML = `
    <div class="te-panel-header">
      <span class="te-panel-title">Enhancing ${ticketId}</span>
      <div class="te-panel-controls">
        <button class="te-panel-btn te-panel-cancel" title="Cancel enhancement">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          <span>Cancel</span>
        </button>
        <button class="te-panel-btn te-panel-minimize" title="Minimize panel">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
      </div>
    </div>
    <div class="te-panel-body"></div>
  `;

  // Cancel button
  el.querySelector(".te-panel-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    cancelEnhancement();
  });

  // Minimize button — shrinks to a small pill
  el.querySelector(".te-panel-minimize").addEventListener("click", (e) => {
    e.stopPropagation();
    minimizePanel();
  });

  document.body.appendChild(el);
  panel = el;
  return el;
}

function minimizePanel() {
  if (!panel) return;
  panel.classList.add("te-minimized");
  // Add click-to-expand on the header when minimized
  const header = panel.querySelector(".te-panel-header");
  header._expandHandler = (e) => {
    // Only expand if clicking on the header area itself (not buttons)
    if (e.target.closest(".te-panel-btn")) return;
    expandPanel();
  };
  header.addEventListener("click", header._expandHandler);
}

function expandPanel() {
  if (!panel) return;
  panel.classList.remove("te-minimized");
  const header = panel.querySelector(".te-panel-header");
  if (header._expandHandler) {
    header.removeEventListener("click", header._expandHandler);
    header._expandHandler = null;
  }
  // Scroll to bottom of body
  const body = panel.querySelector(".te-panel-body");
  if (body) body.scrollTop = body.scrollHeight;
}

function cancelEnhancement() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  addLog("Enhancement cancelled by user.", "te-error");
  if (panel) {
    const title = panel.querySelector(".te-panel-title");
    if (title) title.textContent = "Enhancement cancelled";
    // Hide cancel button, keep minimize
    const cancelBtn = panel.querySelector(".te-panel-cancel");
    if (cancelBtn) cancelBtn.style.display = "none";
  }
  resetButton();
  isEnhancing = false;
}

function resetButton() {
  if (enhanceBtn) {
    enhanceBtn.classList.remove("te-running");
    enhanceBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg> Enhance`;
  }
}

function addLog(text, cls = "te-status", iconHtml = "") {
  if (!panel) return;
  const body = panel.querySelector(".te-panel-body");
  const entry = document.createElement("div");
  entry.className = `te-log-entry ${cls}`;
  if (iconHtml) {
    entry.innerHTML = iconHtml + `<span>${escapeHtml(text)}</span>`;
  } else {
    entry.textContent = text;
  }
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Handle Enhance click
async function onEnhanceClick() {
  if (isEnhancing) return; // Prevent double-clicks

  const ticketId = getTicketIdFromUrl();
  if (!ticketId) {
    alert("Could not detect ticket ID from URL");
    return;
  }

  // Check server health
  try {
    const health = await fetch(`${SERVER_URL}/health`, { headers: getHeaders() });
    if (!health.ok) throw new Error("Server not responding");
  } catch {
    alert(
      `Ticket Enhancer server is not reachable at:\n${SERVER_URL}\n\nIf running locally:\n  cd ticket-enhancer && npm run serve\n\nOr configure a remote server URL in the extension options.`
    );
    return;
  }

  isEnhancing = true;

  // Set button to running state
  if (enhanceBtn) {
    enhanceBtn.classList.add("te-running");
    enhanceBtn.innerHTML = `<div class="te-spinner"></div> Enhancing...`;
  }

  // Open progress panel
  createPanel(ticketId);
  addLog("Connecting to enhancement server...");

  // Create abort controller for this request
  currentAbortController = new AbortController();

  try {
    const response = await fetch(`${SERVER_URL}/enhance`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ticketId }),
      signal: currentAbortController.signal,
    });

    if (response.status === 401) {
      addLog("Authentication failed — check your auth token in extension settings.", "te-error");
      resetButton();
      isEnhancing = false;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            handleSSE(eventType, data);
          } catch {
            // ignore parse errors
          }
          eventType = null;
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      // User cancelled — already handled in cancelEnhancement()
    } else {
      addLog(`Connection error: ${err.message}`, "te-error");
    }
  }

  // Reset button & state
  resetButton();
  isEnhancing = false;
  currentAbortController = null;
}

function handleSSE(event, data) {
  switch (event) {
    case "status":
      addLog(data.message, "te-status");
      break;
    case "tool": {
      const app = getAppForTool(data.name);
      const clean = cleanToolName(data.name);
      const iconSvg = app.icon && APP_ICONS[app.icon]
        ? `<span class="te-app-icon" style="color:${app.color}">${APP_ICONS[app.icon]}</span>`
        : "";
      addLog(`${app.name} → ${clean}`, "te-tool", iconSvg);
      break;
    }
    case "text":
      // Only show substantial text, skip short fragments
      if (data.content && data.content.length > 20) {
        const preview = data.content.slice(0, 120) + (data.content.length > 120 ? "..." : "");
        addLog(preview, "te-text");
      }
      break;
    case "done":
      addLog(`Done! Cost: $${data.cost.toFixed(4)} | Turns: ${data.turns}`, "te-done");
      // Update panel title & hide cancel button
      if (panel) {
        const title = panel.querySelector(".te-panel-title");
        if (title) title.textContent = "Enhancement complete";
        const cancelBtn = panel.querySelector(".te-panel-cancel");
        if (cancelBtn) cancelBtn.style.display = "none";
      }
      break;
    case "error":
      addLog(`Error: ${data.error}`, "te-error");
      // Hide cancel on error too
      if (panel) {
        const cancelBtn = panel.querySelector(".te-panel-cancel");
        if (cancelBtn) cancelBtn.style.display = "none";
      }
      break;
  }
}

// Try to inject the button into Linear's issue header
function injectButton() {
  const ticketId = getTicketIdFromUrl();
  if (!ticketId) {
    // Not on an issue page — remove button if it exists
    if (enhanceBtn) {
      enhanceBtn.remove();
      enhanceBtn = null;
    }
    currentTicketId = null;
    return;
  }

  if (ticketId === currentTicketId && enhanceBtn && document.body.contains(enhanceBtn)) {
    return; // Already injected for this ticket
  }

  currentTicketId = ticketId;

  // Remove old button if any
  if (enhanceBtn) enhanceBtn.remove();

  // Linear's issue detail page has various possible anchor points.
  // We look for the issue identifier text (e.g. "TAP-2661") in the header area.
  // Strategy: find the element that contains the ticket ID text, then insert after it.
  const btn = createButton();

  // Try multiple strategies to find a good insertion point
  const inserted = tryInsertStrategies(btn, ticketId);

  if (inserted) {
    enhanceBtn = btn;
  }
}

function tryInsertStrategies(btn, ticketId) {
  // Strategy 1 (triage view): Find the triage toolbar row with Accept/Decline/Snooze buttons.
  // These buttons live in a row — look for buttons whose text matches triage actions.
  const allButtons = document.querySelectorAll("button");
  for (const b of allButtons) {
    const text = b.textContent.trim();
    if (text === "Accept" || text === "Decline" || text === "Snooze") {
      // Found a triage button — its parent container is the toolbar row
      const toolbar = b.parentElement;
      if (toolbar && !toolbar.querySelector(".te-enhance-btn")) {
        toolbar.insertBefore(btn, toolbar.firstChild);
        return true;
      }
    }
  }

  // Strategy 2: Look for a breadcrumb or identifier that matches the ticket ID
  const allElements = document.querySelectorAll("span, a, div, h1, h2");
  for (const el of allElements) {
    if (
      el.textContent.trim() === ticketId &&
      el.offsetParent !== null &&
      !el.closest(".te-panel")
    ) {
      el.parentElement.insertBefore(btn, el.nextSibling);
      return true;
    }
  }

  // Strategy 3: Look for common Linear issue header patterns
  const possibleHeaders = document.querySelectorAll('[data-testid="issue-title"], [class*="issueTitle"], [class*="IssueTitle"]');
  for (const header of possibleHeaders) {
    header.parentElement.appendChild(btn);
    return true;
  }

  // Strategy 4: fallback — look for the first h1-like element that seems to be a title
  const headings = document.querySelectorAll("h1, h2");
  for (const h of headings) {
    if (h.offsetParent !== null && h.textContent.length > 3 && h.textContent.length < 200) {
      h.parentElement.insertBefore(btn, h.nextSibling);
      return true;
    }
  }

  return false;
}

// Observe DOM changes to re-inject when Linear navigates (SPA)
const observer = new MutationObserver(() => {
  // Debounce
  clearTimeout(observer._timeout);
  observer._timeout = setTimeout(injectButton, 500);
});

observer.observe(document.body, { childList: true, subtree: true });

// Also listen for URL changes (popstate / pushState)
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    injectButton();
  }
}, 500);

// Initial injection
setTimeout(injectButton, 1000);
