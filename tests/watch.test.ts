import { describe, expect, it } from "vitest";
import { chatSummary, watchConditions } from "../agent/orchestrator.js";
import { deleteWatch, getWatch } from "../data/db.js";

describe("freeze watch confirm loop", () => {
  it("proposes, then confirms into SQLite, then briefing mentions it", async () => {
    deleteWatch("rochester", "freeze");
    const proposed = await watchConditions({
      location: "rochester",
      hazard: "freeze",
      confirm: false,
    });
    expect(proposed.card.needsConfirm).toBe(true);
    expect(proposed.spoken.toLowerCase()).toMatch(/confirm/);
    const pending = getWatch("rochester", "freeze");
    expect(pending?.status === "pending" || pending?.status === "active").toBe(true);

    const confirmed = await watchConditions({
      location: "rochester",
      hazard: "freeze",
      confirm: true,
    });
    expect(confirmed.data.confirmed).toBe(true);
    expect(getWatch("rochester", "freeze")?.status).toBe("active");
    expect(confirmed.spoken.toLowerCase()).toMatch(/watch is on|already on/);

    const brief = await chatSummary({ location: "rochester" });
    expect(brief.spoken.toLowerCase()).toMatch(/freeze watch/);
  });
});
