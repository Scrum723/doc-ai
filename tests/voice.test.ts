import { describe, expect, it } from "vitest";
import { joinSpoken, spoken } from "../agent/voice.js";
import { chatSummary } from "../agent/orchestrator.js";

describe("voice formatter (shipped)", () => {
  it("strips markdown and returns spoken prose", () => {
    const out = spoken("**Hello** from [Doc](http://x) with `code` and # heading");
    expect(out).not.toMatch(/[*_`#\[\]]/);
    expect(out.length).toBeGreaterThan(5);
    expect(out.endsWith(".")).toBe(true);
  });

  it("chat_summary is non-empty spoken prose without markdown", async () => {
    const result = await chatSummary({ location: "rochester" });
    expect(result.spoken.length).toBeGreaterThan(40);
    expect(result.spoken).not.toMatch(/\*\*|__|```|# /);
    expect(result.spoken.toLowerCase()).toMatch(/rochester|degrees|briefing/);
  });

  it("joinSpoken concatenates without markdown fences", () => {
    const s = joinSpoken(["Clear **skies**", "Wind 6 mph"]);
    expect(s).not.toContain("**");
  });
});
