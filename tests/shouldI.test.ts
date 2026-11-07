import { describe, expect, it } from "vitest";
import { decideShouldI, freezeBand, parseActivity } from "../agent/shouldI.js";
import { shouldI } from "../agent/orchestrator.js";

const mild = {
  locationLabel: "Rochester / North Greece / Long Pond",
  tempF: 55,
  minTempF: 42,
  windMph: 6,
  precipIn: 0,
  conditionText: "Clear",
  forecastTexts: ["Sunny", "Partly cloudy"],
  forecastPrecip: [0, 0.05],
  alertEvents: [] as string[],
};

describe("should_i decisions", () => {
  it("parses household activities", () => {
    expect(parseActivity("Should I leave the hose out?")).toBe("leave_hose");
    expect(parseActivity("cover the grill tonight")).toBe("cover_grill");
  });

  it("says no to leaving the hose when freeze is likely", () => {
    const out = decideShouldI("leave_hose", { ...mild, minTempF: 28, tempF: 31 });
    expect(out.decision).toBe("no");
    expect(out.spoken.toLowerCase()).toMatch(/hose|freeze|drain/);
    expect(out.card.needsConfirm).toBeUndefined();
  });

  it("says yes to leaving the hose when overnight stays mild", () => {
    const out = decideShouldI("leave_hose", mild);
    expect(out.decision).toBe("yes");
    expect(freezeBand(mild)).toBe("none");
  });

  it("tells you to cover the grill when rain is coming", () => {
    const out = decideShouldI("cover_grill", {
      ...mild,
      forecastTexts: ["Showers"],
      forecastPrecip: [0.3],
    });
    expect(out.decision).toBe("yes");
    expect(out.action.toLowerCase()).toMatch(/cover/);
  });

  it("tool returns a glanceable card", async () => {
    const out = await shouldI({ location: "rochester", activity: "Should I leave the hose out?" });
    expect(out.card.headline.length).toBeGreaterThan(1);
    expect(out.spoken.endsWith(".") || out.spoken.endsWith("?")).toBe(true);
    expect(["yes", "caution", "no"]).toContain(out.data.decision);
  });
});
