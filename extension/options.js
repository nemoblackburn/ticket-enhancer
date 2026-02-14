// Ticket Enhancer — Options page logic

const serverUrlInput = document.getElementById("serverUrl");
const authTokenInput = document.getElementById("authToken");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");

// Load saved settings
chrome.storage.sync.get(["serverUrl", "authToken"], (result) => {
  if (result.serverUrl) serverUrlInput.value = result.serverUrl;
  if (result.authToken) authTokenInput.value = result.authToken;
});

// Save settings
saveBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, "");
  const authToken = authTokenInput.value.trim();

  chrome.storage.sync.set({ serverUrl, authToken }, () => {
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
    showStatus(`Connected! Model: ${data.model} | MCP: ${data.mcpMode}`, "success");
  } catch (err) {
    showStatus(`Cannot reach server at ${serverUrl}`, "error");
  }
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}
