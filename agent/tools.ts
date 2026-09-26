import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  chatSummary,
  getAlerts,
  getCurrentWeather,
  getForecast,
  getHistorical,
  listIotSourcesTool,
} from "./orchestrator.js";

export const TOOL_NAMES = [
  "get_current_weather",
  "get_forecast",
  "get_alerts",
  "get_historical",
  "list_iot_sources",
  "chat_summary",
] as const;

function mcpResult(out: { spoken: string; data: Record<string, unknown> }) {
  return {
    content: [{ type: "text" as const, text: `${out.spoken}\n\n${JSON.stringify(out.data)}` }],
    structuredContent: { spoken: out.spoken, ...out.data },
  };
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "get_current_weather",
    {
      description: "Current weather for a location. Defaults to Rochester, NY.",
      inputSchema: {
        location: z.string().optional().describe("City or location key"),
      },
    },
    async (args) => mcpResult(await getCurrentWeather(args))
  );

  server.registerTool(
    "get_forecast",
    {
      description: "Daily forecast. location plus days (default 7).",
      inputSchema: {
        location: z.string().optional(),
        days: z.number().optional(),
      },
    },
    async (args) => mcpResult(await getForecast(args))
  );

  server.registerTool(
    "get_alerts",
    {
      description: "Active NWS weather alerts for a location.",
      inputSchema: { location: z.string().optional() },
    },
    async (args) => mcpResult(await getAlerts(args))
  );

  server.registerTool(
    "get_historical",
    {
      description: "Historical stored readings. date_range like 2026-09-15 to 2026-09-18.",
      inputSchema: {
        location: z.string().optional(),
        date_range: z.string().optional(),
      },
    },
    async (args) => mcpResult(await getHistorical(args))
  );

  server.registerTool(
    "list_iot_sources",
    {
      description: "List simulated IoT weather nodes Doc AI is absorbing.",
      inputSchema: { location: z.string().optional() },
    },
    async (args) => mcpResult(await listIotSourcesTool(args))
  );

  server.registerTool(
    "chat_summary",
    {
      description: "Natural-language spoken briefing combining current, forecast, alerts, and IoT.",
      inputSchema: { location: z.string().optional() },
    },
    async (args) => mcpResult(await chatSummary(args))
  );
}

export async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_current_weather":
      return getCurrentWeather(args as any);
    case "get_forecast":
      return getForecast(args as any);
    case "get_alerts":
      return getAlerts(args as any);
    case "get_historical":
      return getHistorical(args as any);
    case "list_iot_sources":
      return listIotSourcesTool(args as any);
    case "chat_summary":
      return chatSummary(args as any);
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
