/**
 * Simulated worldwide IoT sensor feed — labeled simulation, not live Ring/camera weather.
 */
import { loadSeed } from "./locations.js";
import { normalizeIot, type NormalizedReading } from "./normalize.js";
import { listIotSources, upsertIotSource, upsertReading } from "./db.js";

export function registerIotFromSeed(): void {
  const seed = loadSeed();
  for (const s of seed.iotSources) {
    upsertIotSource({
      id: s.id,
      name: s.name,
      locationKey: s.locationKey,
      type: s.type,
      lat: s.lat,
      lon: s.lon,
      unit: s.unit,
    });
  }
}

export function tickIot(locationKey?: string): NormalizedReading[] {
  const sources = listIotSources(locationKey) as any[];
  const out: NormalizedReading[] = [];
  for (const s of sources) {
    let value = 0;
    if (s.type === "temperature") value = 50 + Math.round(Math.random() * 12);
    else if (s.type === "humidity") value = 55 + Math.round(Math.random() * 25);
    else if (s.type === "wind") value = 4 + Math.round(Math.random() * 14);
    else value = Number((Math.random() * 0.2).toFixed(2));
    const reading = normalizeIot(s.location_key, s.id, s.type, value, s.unit || "");
    upsertReading(reading);
    out.push(reading);
  }
  return out;
}
