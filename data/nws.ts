/**
 * NWS alerts ingest — https://api.weather.gov (free, descriptive User-Agent required)
 * Second public weather API alongside Open-Meteo.
 */
import { normalizeNwsAlert, type NormalizedReading } from "./normalize.js";

const BASE = "https://api.weather.gov";

function userAgent(): string {
  return (
    process.env.NWS_USER_AGENT ||
    "DocAI/1.0 (contact: cclot1@brockport.edu; https://github.com/Scrum723/doc-ai)"
  );
}

export async function fetchNwsAlerts(
  lat: number,
  lon: number,
  locationKey: string
): Promise<{ readings: NormalizedReading[]; error?: string }> {
  const url = `${BASE}/alerts/active?point=${lat},${lon}&status=actual`;
  console.log(`[NWS] GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/geo+json, application/json",
      },
    });
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    const json = await res.json();
    const readings = (json.features || []).map((f: any) => normalizeNwsAlert(locationKey, f));
    return { readings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[NWS] failed: ${message}`);
    return { readings: [], error: message };
  }
}
