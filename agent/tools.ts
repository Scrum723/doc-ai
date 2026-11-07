import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  chatSummary,
  getAlerts,
  getCurrentWeather,
  getForecast,
  getHistorical,
  listIotSourcesTool,
  shouldI,
  watchConditions,
} from "./orchestrator.js";
import type { ToolOut } from "./orchestrator.js";

export const TOOL_CATALOG = [
  {
    name: "get_current_weather",
    description: "Current weather for a location. Defaults to Rochester, NY.",
    inputSchema: {
      type: "object",
      properties: { location: { type: "string", description: "City or location key" } },
    },
  },
  {
    name: "get_forecast",
    description: "Daily forecast. location plus days (default 3).",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string" },
        days: { type: "number" },
      },
    },
  },
  {
    name: "get_alerts",
    description: "Active NWS weather alerts for a location.",
    inputSchema: {
      type: "object",
      properties: { location: { type: "string" } },
    },
  },
  {
    name: "get_historical",
    description: "Historical stored readings. date_range like 2026-09-15 to 2026-09-18.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string" },
        date_range: { type: "string" },
      },
    },
  },
  {
    name: "list_iot_sources",
    description: "List simulated IoT weather nodes Doc AI is absorbing.",
    inputSchema: {
      type: "object",
      properties: { location: { type: "string" } },
    },
  },
  {
    name: "chat_summary",
    description: "Spoken briefing combining current, forecast, alerts, IoT, and any confirmed watches.",
    inputSchema: {
      type: "object",
      properties: { location: { type: "string" } },
    },
  },
  {
    name: "should_i",
    description:
      "Finish a household weather job: should I leave the hose out, cover the grill, walk the dog, drive, or leave the boat. Returns yes, caution, or no with one reason.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string" },
        activity: { type: "string", description: "What the customer wants to do" },
      },
    },
  },
  {
    name: "watch_conditions",
    description:
      "Propose or confirm a condition watch (default freeze). First call asks Confirm. confirm=true stores the watch in SQLite and includes it in chat_summary.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string" },
        hazard: { type: "string" },
        confirm: { type: "boolean" },
      },
    },
  },
] as const;

export const TOOL_NAMES = TOOL_CATALOG.map((t) => t.name);

function mcpResult(out: ToolOut) {
  return {
    content: [{ type: "text" as const, text: `${out.spoken}\n\n${JSON.stringify(out.data)}` }],
    structuredContent: { spoken: out.spoken, card: out.card, ...out.data },
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
      description: "Daily forecast. location plus days (default 3).",
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
      description: "Spoken briefing combining current, forecast, alerts, IoT, and any confirmed watches.",
      inputSchema: { location: z.string().optional() },
    },
    async (args) => mcpResult(await chatSummary(args))
  );

  server.registerTool(
    "should_i",
    {
      description:
        "Finish a household weather job: leave the hose out, cover the grill, walk the dog, drive, or leave the boat.",
      inputSchema: {
        location: z.string().optional(),
        activity: z.string().optional(),
      },
    },
    async (args) => mcpResult(await shouldI(args))
  );

  server.registerTool(
    "watch_conditions",
    {
      description: "Propose or confirm a condition watch. confirm=true writes it to SQLite.",
      inputSchema: {
        location: z.string().optional(),
        hazard: z.string().optional(),
        confirm: z.boolean().optional(),
      },
    },
    async (args) => mcpResult(await watchConditions(args))
  );
}

export async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_current_weather":
      return getCurrentWeather(args as { location?: string });
    case "get_forecast":
      return getForecast(args as { location?: string; days?: number });
    case "get_alerts":
      return getAlerts(args as { location?: string });
    case "get_historical":
      return getHistorical(args as { location?: string; date_range?: string });
    case "list_iot_sources":
      return listIotSourcesTool(args as { location?: string });
    case "chat_summary":
      return chatSummary(args as { location?: string });
    case "should_i":
      return shouldI(args as { location?: string; activity?: string });
    case "watch_conditions":
      return watchConditions(args as { location?: string; hazard?: string; confirm?: boolean });
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
