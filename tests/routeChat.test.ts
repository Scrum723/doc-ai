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
  it("routes household jobs to should_i", () => {
    expect(pickTool("Should I leave the hose out?").name).toBe("should_i");
  });
  it("routes freeze watch before alerts", () => {
    expect(pickTool("Watch Rochester for freeze").name).toBe("watch_conditions");
    expect(pickTool("Confirm freeze watch").name).toBe("watch_conditions");
    expect(pickTool("Confirm freeze watch").args.confirm).toBe(true);
  });
  it("keeps freeze warnings on alerts", () => {
    expect(pickTool("any freeze warnings?").name).toBe("get_alerts");
  });
});
