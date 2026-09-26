import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../agent/tools.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Doc AI surface", () => {
  it("exposes the six exact tool names", () => {
    expect([...TOOL_NAMES].sort()).toEqual(
      [
        "chat_summary",
        "get_alerts",
        "get_current_weather",
        "get_forecast",
        "get_historical",
        "list_iot_sources",
      ].sort()
    );
  });

  it("server imports official MCP SDK and both weather hosts", () => {
    const server = readFileSync(join(root, "server/index.ts"), "utf8");
    expect(server).toContain("@modelcontextprotocol/sdk/server/mcp.js");
    expect(server).toContain("StreamableHTTPServerTransport");
    expect(server).toContain("originGuard");
    expect(server).toContain('app.get("/mcp"');
    expect(server).toContain('app.post("/mcp"');
    const om = readFileSync(join(root, "data/openmeteo.ts"), "utf8");
    const nws = readFileSync(join(root, "data/nws.ts"), "utf8");
    expect(om).toContain("api.open-meteo.com");
    expect(nws).toContain("api.weather.gov");
  });
});
