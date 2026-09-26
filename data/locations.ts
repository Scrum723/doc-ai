import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "seed.json");

let cached: SeedFile | null = null;

export function loadSeed(): any {
  if (!cached) cached = JSON.parse(readFileSync(SEED_PATH, "utf8"));
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
