import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LocationRecord = {
  key: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
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

export function loadSeed(): any {
  if (!cached) cached = JSON.parse(readFileSync(seedPath(), "utf8"));
  return cached;
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
  const raw = (input?.location || input?.city || process.env.DEFAULT_LOCATION || "rochester")
    .trim()
    .toLowerCase();
  for (const loc of Object.values(data.locations)) {
    if (loc.key === raw || loc.name.toLowerCase() === raw || loc.label.toLowerCase().includes(raw)) {
      return loc;
    }
  }
  for (const loc of Object.values(data.locations)) {
    if (raw.includes(loc.key) || loc.name.toLowerCase().includes(raw)) return loc;
  }
  return data.locations.rochester;
}

export function listLocations(): LocationRecord[] {
  return Object.values((loadSeed() as SeedFile).locations);
}
