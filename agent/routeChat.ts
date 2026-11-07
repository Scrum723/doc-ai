import { resolveLocation } from "../data/locations.js";
import { getForecast } from "./orchestrator.js";
import { runTool } from "./tools.js";
import { buildVisuals, detectProducts } from "./visuals.js";

/** Map a natural question to the same MCP tools Alexa+ would call. */
export function pickTool(message: string): { name: string; args: Record<string, unknown> } {
  const s = message.toLowerCase();
  if (/\biot\b|sensor|probe|mesh/.test(s)) return { name: "list_iot_sources", args: {} };
  if (/should i|can i|safe to|leave the hose|cover the grill|walk the dog|cover the boat/.test(s)) {
    return { name: "should_i", args: { activity: message } };
  }
  if (/\bradar\b|\bsatellite\b|\bgoes\b|\bskew|\bsounding\b|\bupper[-\s]?air\b|\b500\s*mb\b|\bhodograph\b|\boutlook\b|\bmeteogram\b/.test(s)) {
    return { name: "chat_summary", args: {} };
  }
  if (
    /\b(confirm|confirmed|go ahead)\b/.test(s) &&
    !/warning|yesterday/.test(s)
  ) {
    return { name: "watch_conditions", args: { confirm: true, hazard: message } };
  }
  if (/\bwatch for\b|\bfreeze watch\b|keep (an |a )?eye|set a watch|^watch /.test(s)) {
    return { name: "watch_conditions", args: { confirm: false, hazard: message } };
  }
  if (/\bbrief|summary|everything|situation|what's happening|whats happening/.test(s)) {
    return { name: "chat_summary", args: {} };
  }
  if (/\bhistor|last week|yesterday|2026-09|archive/.test(s)) {
    return { name: "get_historical", args: { date_range: "2026-09-15 to 2026-09-18" } };
  }
  if (/\balert|warning|advisory/.test(s)) return { name: "get_alerts", args: {} };
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
  const loc = resolveLocation({
    location: input.location_name || "rochester",
  });
  const picked = pickTool(input.message || "");
  const args = { ...picked.args, location: loc.key };
  const out = await runTool(picked.name, args);
  const spoken = out.spoken;
  const products = detectProducts(input.message || "");
  const nested = out.data as { forecast?: unknown; reading?: unknown };
  let forecast = Array.isArray(nested.forecast)
    ? nested.forecast
    : Array.isArray((nested.forecast as { forecast?: unknown } | undefined)?.forecast)
      ? (nested.forecast as { forecast: unknown[] }).forecast
      : [];
  const needsChart =
    products.includes("forecast_chart") ||
    picked.name === "chat_summary" ||
    picked.name === "should_i" ||
    picked.name === "get_forecast" ||
    picked.name === "get_current_weather";
  if (needsChart && !forecast.length) {
    const fc = await getForecast({ location: loc.key, days: 3 });
    forecast = (fc.data.forecast as unknown[]) || [];
  }
  const pack = buildVisuals({
    message: input.message || "",
    lat: loc.lat,
    lon: loc.lon,
    locationName: loc.label,
    toolName: picked.name,
    toolData: { ...out.data, forecast, reading: nested.reading },
  });
  return {
    agent: "doc",
    intent: picked.name,
    tool: picked.name,
    location: input.location || [loc.lat, loc.lon],
    location_name: loc.label,
    response_text: spoken,
    doc_response: { activated: true, response: spoken },
    modules_invoked: ["alexa_mcp", picked.name, "doc_visuals"],
    source: "doc-ai-alexa-mcp",
    llm: "alexa-plus",
    note: "MCP tool facts for Alexa+. Visuals are live NOAA/IEM/WPC/SPC products.",
    spoken,
    data: out.data,
    card: out.card,
    visuals: pack.visuals,
    products_requested: products,
    products_delivered: pack.products,
  };
}
