import { runTool } from "./tools.js";

/** Map a natural question to the same MCP tools Alexa+ would call. */
export function pickTool(message: string): { name: string; args: Record<string, unknown> } {
  const s = message.toLowerCase();
  if (/\biot\b|sensor|probe|mesh/.test(s)) return { name: "list_iot_sources", args: {} };
  if (/\bbrief|summary|everything|situation|what's happening|whats happening/.test(s)) {
    return { name: "chat_summary", args: {} };
  }
  if (/\bhistor|last week|yesterday|2026-09|archive/.test(s)) {
    return { name: "get_historical", args: { date_range: "2026-09-15 to 2026-09-18" } };
  }
  if (/\balert|warning|watch|advisory/.test(s)) return { name: "get_alerts", args: {} };
  if (/\bforecast|tomorrow|tonight|weekend|days?\b/.test(s)) {
    return { name: "get_forecast", args: { days: 3 } };
  }
  return { name: "get_current_weather", args: {} };
}

export async function talkToDocMcp(input: {
  message: string;
  location_name?: string;
  location?: [number, number] | number[];
}) {
  const location = input.location_name || "rochester";
  const picked = pickTool(input.message || "");
  const args = { ...picked.args, location };
  const out = await runTool(picked.name, args);
  const spoken = out.spoken;
  return {
    agent: "doc",
    intent: picked.name,
    tool: picked.name,
    location: input.location || [43.255, -77.685],
    location_name: location,
    response_text: spoken,
    doc_response: { activated: true, response: spoken },
    modules_invoked: ["alexa_mcp", picked.name],
    source: "doc-ai-alexa-mcp",
    llm: "alexa-plus",
    note: "MCP tool facts for Alexa+. No Grok.",
    spoken,
    data: out.data,
  };
}
