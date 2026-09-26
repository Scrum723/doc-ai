import { describe, expect, it } from "vitest";
import { pickTool } from "../agent/routeChat.js";

describe("pickTool (Alexa+ MCP routing)", () => {
  it("routes forecast language to get_forecast", () => {
    expect(pickTool("three day forecast").name).toBe("get_forecast");
  });
  it("routes alerts to get_alerts", () => {
    expect(pickTool("any freeze warnings?").name).toBe("get_alerts");
  });
  it("defaults to current weather", () => {
    expect(pickTool("what's the weather in Rochester?").name).toBe("get_current_weather");
  });
});
