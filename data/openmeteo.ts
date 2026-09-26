/**
 * Open-Meteo ingest — https://api.open-meteo.com (free, no key)
 * Forecast + current. Historical archive: https://archive-api.open-meteo.com
 */
import {
  normalizeOpenMeteoCurrent,
  normalizeOpenMeteoForecastDay,
  type NormalizedReading,
} from "./normalize.js";

const FORECAST_HOST = "https://api.open-meteo.com";
const ARCHIVE_HOST = "https://archive-api.open-meteo.com";

export async function fetchOpenMeteoCurrentAndForecast(
  lat: number,
  lon: number,
  locationKey: string,
  days = 7
): Promise<{ current: NormalizedReading; forecast: NormalizedReading[]; error?: string }> {
  const url =
    `${FORECAST_HOST}/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
    `&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code` +
    `&forecast_days=${Math.min(16, Math.max(1, days))}` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
  console.log(`[Open-Meteo] GET ${url}`);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();
    const current = normalizeOpenMeteoCurrent(locationKey, json);
    const daily = json.daily || {};
    const forecast: NormalizedReading[] = [];
    const times: string[] = daily.time || [];
    for (let i = 0; i < times.length; i++) {
      forecast.push(
        normalizeOpenMeteoForecastDay(
          locationKey,
          times[i],
          daily.temperature_2m_max?.[i] ?? null,
          daily.precipitation_sum?.[i] ?? null,
          daily.wind_speed_10m_max?.[i] ?? null,
          daily.weather_code?.[i]
        )
      );
    }
    return { current, forecast };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Open-Meteo] failed: ${message}`);
    return {
      current: {
        locationKey,
        source: "open-meteo",
        kind: "current",
        observedAt: new Date().toISOString(),
        tempF: null,
        humidityPct: null,
        windMph: null,
        precipIn: null,
        text: "",
        extra: { error: message, host: "api.open-meteo.com" },
      },
      forecast: [],
      error: message,
    };
  }
}

export async function fetchOpenMeteoHistorical(
  lat: number,
  lon: number,
  locationKey: string,
  start: string,
  end: string
): Promise<{ readings: NormalizedReading[]; error?: string }> {
  const url =
    `${ARCHIVE_HOST}/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start.slice(0, 10)}&end_date=${end.slice(0, 10)}` +
    `&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
  console.log(`[Open-Meteo archive] GET ${url}`);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`);
    const json = await res.json();
    const daily = json.daily || {};
    const times: string[] = daily.time || [];
    const readings: NormalizedReading[] = times.map((t, i) => ({
      locationKey,
      source: "open-meteo" as const,
      kind: "historical" as const,
      observedAt: t,
      tempF: daily.temperature_2m_max?.[i] ?? null,
      humidityPct: null,
      windMph: daily.wind_speed_10m_max?.[i] ?? null,
      precipIn: daily.precipitation_sum?.[i] ?? null,
      text: "Archive daily max",
      extra: { host: "archive-api.open-meteo.com" },
    }));
    return { readings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Open-Meteo archive] failed: ${message}`);
    return { readings: [], error: message };
  }
}
