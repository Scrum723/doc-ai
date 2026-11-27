import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LocationRecord = {
  key: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  unknown?: boolean;
};

type SeedFile = {
  locations: Record<string, LocationRecord>;
};

const SEED_CANDIDATES = [
  join(process.cwd(), "data", "seed.json"),
  join(process.cwd(), "seed.json"),
  join("/var/task", "data", "seed.json"),
  join("/var/task", "seed.json"),
];

let cached: SeedFile | null = null;

function seedPath(): string {
  for (const p of SEED_CANDIDATES) {
    try {
      readFileSync(p, "utf8");
      return p;
    } catch {
      /* try next */
    }
  }
  throw new Error(`seed.json not found in ${SEED_CANDIDATES.join(", ")}`);
}

/**
 * Precise pins never live in git. To use exact spots locally, point
 * DOC_AI_LOCATIONS_FILE at a private JSON file shaped like
 * { "locations": { "<key>": { key, name, label, lat, lon } } };
 * its entries override the public city/county-level seed.
 */
function privateLocations(): Record<string, LocationRecord> {
  const path = (process.env.DOC_AI_LOCATIONS_FILE || "").trim();
  if (!path) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const locs = parsed && typeof parsed === "object" ? parsed.locations : null;
    return locs && typeof locs === "object" ? (locs as Record<string, LocationRecord>) : {};
  } catch {
    return {};
  }
}

export function loadSeed(): any {
  if (!cached) {
    const seed = JSON.parse(readFileSync(seedPath(), "utf8"));
    seed.locations = { ...(seed.locations || {}), ...privateLocations() };
    cached = seed;
  }
  return cached;
}

/** Test hook: drop the cached seed so env changes take effect. */
export function resetSeedCache(): void {
  cached = null;
}

export function resolveLocation(input?: {
  location?: string;
  city?: string;
  lat?: number;
  lon?: number;
}): LocationRecord {
  const data = loadSeed() as SeedFile;
  if (typeof input?.lat === "number" && typeof input?.lon === "number") {
    return {
      key: "custom",
      name: `Custom (${input.lat.toFixed(3)}, ${input.lon.toFixed(3)})`,
      label: `Coordinates ${input.lat}, ${input.lon}`,
      lat: input.lat,
      lon: input.lon,
    };
  }
  const raw = (input?.location || input?.city || "").trim().toLowerCase();
  if (!raw) {
    const fallback = (process.env.DEFAULT_LOCATION || "rochester").toLowerCase();
    return data.locations[fallback] || data.locations.rochester;
  }
  for (const loc of Object.values(data.locations)) {
    if (loc.key === raw || loc.name.toLowerCase() === raw || loc.label.toLowerCase().includes(raw)) {
      return loc;
    }
  }
  for (const loc of Object.values(data.locations)) {
    if (raw.includes(loc.key) || loc.name.toLowerCase().includes(raw)) return loc;
  }
  return {
    key: "unknown",
    name: raw,
    label: raw,
    lat: 0,
    lon: 0,
    unknown: true,
  };
}

export function listLocations(): LocationRecord[] {
  return Object.values((loadSeed() as SeedFile).locations);
}
