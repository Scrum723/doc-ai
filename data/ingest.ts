import { seedDatabase } from "./seed.js";
import { fetchOpenMeteoCurrentAndForecast, fetchOpenMeteoHistorical } from "./openmeteo.js";
import { fetchNwsAlerts } from "./nws.js";
import { registerIotFromSeed, tickIot } from "./iot.js";
import { replaceKind, upsertReading } from "./db.js";
import type { LocationRecord } from "./locations.js";

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;
  seedDatabase();
  registerIotFromSeed();
  seeded = true;
}

/** Refresh live APIs into SQLite; keep seed rows if APIs fail. */
export async function refreshLocation(loc: LocationRecord, days = 7): Promise<{
  live: boolean;
  errors: string[];
}> {
  ensureSeeded();
  const errors: string[] = [];
  let live = false;

  const om = await fetchOpenMeteoCurrentAndForecast(loc.lat, loc.lon, loc.key, days);
  if (om.error) errors.push(`open-meteo: ${om.error}`);
  else {
    live = true;
    replaceKind(loc.key, "current", [om.current]);
    if (om.forecast.length) replaceKind(loc.key, "forecast", om.forecast);
  }

  const nws = await fetchNwsAlerts(loc.lat, loc.lon, loc.key);
  if (nws.error) errors.push(`nws: ${nws.error}`);
  else {
    live = true;
    replaceKind(loc.key, "alert", nws.readings);
  }

  tickIot(loc.key);
  return { live, errors };
}

export async function refreshHistorical(
  loc: LocationRecord,
  start: string,
  end: string
): Promise<{ error?: string }> {
  ensureSeeded();
  const hist = await fetchOpenMeteoHistorical(loc.lat, loc.lon, loc.key, start, end);
  if (hist.error) return { error: hist.error };
  for (const r of hist.readings) upsertReading(r);
  return {};
}
