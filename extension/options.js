// Ticket Enhancer — Options page logic

const serverUrlInput = document.getElementById("serverUrl");
const authTokenInput = document.getElementById("authToken");
const extraInstructionsInput = document.getElementById("extraInstructions");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");
const gettingStartedEl = document.getElementById("gettingStarted");
const mcpServersEl = document.getElementById("mcpServers");
const mcpServerListEl = document.getElementById("mcpServerList");

// Load saved settings
chrome.storage.sync.get(
  ["serverUrl", "authToken", "extraInstructions", "onboardingComplete"],
  (result) => {
    if (result.serverUrl) serverUrlInput.value = result.serverUrl;
    if (result.authToken) authTokenInput.value = result.authToken;
    if (result.extraInstructions) extraInstructionsInput.value = result.extraInstructions;

    // Show getting started section for first-time users
    if (!result.onboardingComplete) {
      gettingStartedEl.style.display = "block";
    }
  }
);

// Save settings
saveBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, "");
  const authToken = authTokenInput.value.trim();
  const extraInstructions = extraInstructionsInput.value;

  chrome.storage.sync.set({ serverUrl, authToken, extraInstructions }, () => {
    showStatus("Settings saved. Reload any open Linear tabs.", "success");
  });
});

// Test connection
testBtn.addEventListener("click", async () => {
  const serverUrl = (serverUrlInput.value.trim().replace(/\/+$/, "")) || "http://localhost:7842";
  const authToken = authTokenInput.value.trim();

  showStatus("Testing connection...", "info");

  const headers = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const resp = await fetch(`${serverUrl}/health`, { headers });
    if (resp.status === 401) {
      showStatus("Auth failed — check your token.", "error");
      return;
    }
    if (!resp.ok) {
      showStatus(`Server returned ${resp.status}`, "error");
      return;
    }
    const data = await resp.json();

    // Show MCP servers with status dots (mirrors Claude Code /mcp)
    if (data.mcpServers && data.mcpServers.length > 0) {
      const statusColors = {
        connected: "#4ade80", auth_error: "#facc15",
        error: "#f87171", unknown: "#a0a0a0", not_found: "#f87171",
      };
      const statusLabels = {
        connected: "", auth_error: "(needs auth)",
        error: "(unreachable)", unknown: "", not_found: "(not found)",
      };
      mcpServerListEl.innerHTML = data.mcpServers
        .map((s) => {
          const name = typeof s === "string" ? s : s.name;
          const status = typeof s === "string" ? "connected" : (s.status || "connected");
          const color = statusColors[status] || "#a0a0a0";
          const label = statusLabels[status] || "";
          const labelHtml = label ? ` <span style="color:#888;font-size:10px;">${label}</span>` : "";
          return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#ccc;"><span style="width:6px;height:6px;border-radius:50%;background:${color};"></span> ${name}${labelHtml}</span>`;
        })
        .join("");
      mcpServersEl.style.display = "block";
      showStatus(`Connected! Model: ${data.model}`, "success");
    } else {
      mcpServersEl.style.display = "none";
      showStatus(`Connected! Model: ${data.model} | No MCP servers found`, "success");
    }

    // Mark onboarding complete on successful test
    chrome.storage.sync.set({ onboardingComplete: true });
    gettingStartedEl.style.display = "none";
  } catch (err) {
    mcpServersEl.style.display = "none";
    showStatus(`Cannot reach server at ${serverUrl}`, "error");
  }
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}
