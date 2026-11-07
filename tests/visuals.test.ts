import { describe, expect, it } from "vitest";
import { pickTool, talkToDocMcp } from "../agent/routeChat.js";
import { detectProducts, buildVisuals } from "../agent/visuals.js";

describe("Alexa+ chat visuals", () => {
  it("detects radar, upper air, and forecast chart", () => {
    expect(detectProducts("show radar")).toContain("radar");
    expect(detectProducts("upper air maps")).toContain("upper_air");
    expect(detectProducts("500 mb")).toContain("upper_air");
    expect(detectProducts("forecast chart")).toContain("forecast_chart");
    expect(detectProducts("skew-t")).toContain("skew_t");
  });

  it("routes product language to a briefing tool", () => {
    expect(pickTool("Show radar").name).toBe("chat_summary");
    expect(pickTool("Upper air maps").name).toBe("chat_summary");
  });

  it("builds live NOAA/IEM image products", () => {
    const pack = buildVisuals({
      message: "show radar and upper air",
      lat: 43.255,
      lon: -77.685,
      locationName: "Rochester",
      toolData: {
        reading: { tempF: 54, humidityPct: 80, windMph: 7, text: "Clear" },
        forecast: [
          { observedAt: "2026-10-08", tempF: 55, text: "Clear" },
          { observedAt: "2026-10-09", tempF: 62, text: "Rain" },
        ],
      },
    });
    expect(pack.visuals.some((v) => v.product === "radar" && v.url)).toBe(true);
    expect(pack.visuals.some((v) => v.product === "upper_air")).toBe(true);
    expect(pack.visuals.some((v) => v.type === "metrics")).toBe(true);
    expect(pack.visuals.some((v) => v.chart_kind === "series")).toBe(true);
  });

  it("talkToDocMcp attaches visuals for a weather ask", async () => {
    const out = await talkToDocMcp({
      message: "What's the weather in Rochester?",
      location_name: "rochester",
      location: [43.255, -77.685],
    });
    expect(Array.isArray(out.visuals)).toBe(true);
    expect(out.visuals.length).toBeGreaterThan(0);
    expect(out.response_text.length).toBeGreaterThan(10);
  });
});
