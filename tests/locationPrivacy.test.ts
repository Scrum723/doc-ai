import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listLocations, resetSeedCache, resolveLocation } from "../data/locations.js";

const PRIVATE_PLACE = /\b(home|house|dock|docks|residence|backyard|porch|driveway|garage)\b/i;

function decimals(n: number): number {
  const s = String(n);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

function walk(node: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(node)) node.forEach((v) => walk(v, visit));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      visit(k, v);
      walk(v, visit);
    }
  }
}

describe("public seed has no precise or private pins", () => {
  for (const file of ["data/seed.json", "dist-lambda/data/seed.json"]) {
    it(`${file}: coords at most 2 decimals, no home/dock labels`, () => {
      const seed = JSON.parse(readFileSync(join(process.cwd(), file), "utf8"));
      walk(seed, (key, value) => {
        if ((key === "lat" || key === "lon") && typeof value === "number") {
          expect(decimals(value), `${file} ${key}`).toBeLessThanOrEqual(2);
        }
        if ((key === "name" || key === "label" || key === "id") && typeof value === "string") {
          expect(PRIVATE_PLACE.test(value), `${file} ${key}=${value}`).toBe(false);
        }
      });
    });
  }
});

describe("DOC_AI_LOCATIONS_FILE private override", () => {
  afterEach(() => {
    delete process.env.DOC_AI_LOCATIONS_FILE;
    resetSeedCache();
  });

  it("merges private pins over the public seed", () => {
    const dir = mkdtempSync(join(tmpdir(), "docai-"));
    const path = join(dir, "private.json");
    writeFileSync(
      path,
      JSON.stringify({ locations: { rochester: { key: "rochester", name: "Rochester, NY", label: "Private", lat: 1.5, lon: 2.5 } } }),
    );
    process.env.DOC_AI_LOCATIONS_FILE = path;
    resetSeedCache();
    expect(resolveLocation({ location: "rochester" }).lat).toBe(1.5);
    expect(listLocations().length).toBeGreaterThanOrEqual(3);
  });

  it("ignores a missing private file", () => {
    process.env.DOC_AI_LOCATIONS_FILE = "/nonexistent/private.json";
    resetSeedCache();
    expect(resolveLocation({ location: "rochester" }).lat).toBe(43.16);
  });
});
