const base = (process.argv[2] || "http://127.0.0.1:8790").replace(/\/$/, "");
const mcp = `${base}/mcp`;
const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

async function rpc(body, sessionId) {
  const h = { ...headers };
  if (sessionId) h["mcp-session-id"] = sessionId;
  const res = await fetch(mcp, { method: "POST", headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { res, json, sessionId: res.headers.get("mcp-session-id") || sessionId };
}

const init = await rpc({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "doc-ai-smoke", version: "1.0.0" },
  },
});
const protocol = init.json?.result?.protocolVersion;
const sessionId = init.sessionId;
await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId);
const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, sessionId);
const names = (tools.json?.result?.tools || []).map((t) => t.name).sort();
console.log(JSON.stringify({ protocolVersion: protocol, sessionId, tools: names }, null, 2));
const required = [
  "get_current_weather",
  "get_forecast",
  "get_alerts",
  "get_historical",
  "list_iot_sources",
  "chat_summary",
];
const missing = required.filter((n) => !names.includes(n));
if (missing.length || !protocol || protocol < "2025-11-25") {
  console.error("FAIL", { missing, protocol });
  process.exit(1);
}
console.log("OK");
