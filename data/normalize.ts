/** Normalize readings from Open-Meteo, NWS, and simulated IoT into one store shape. */

export const SOURCE_OPEN_METEO = "open-meteo";
export const SOURCE_NWS = "nws";
export const SOURCE_IOT = "iot";

export type ReadingKind = "current" | "forecast" | "alert" | "historical" | "iot";

export type NormalizedReading = {
  locationKey: string;
  source: typeof SOURCE_OPEN_METEO | typeof SOURCE_NWS | typeof SOURCE_IOT;
  kind: ReadingKind;
  observedAt: string;
  tempF: number | null;
  humidityPct: number | null;
  windMph: number | null;
  precipIn: number | null;
  text: string;
  extra?: Record<string, unknown>;
};

export function cToF(c: number | null | undefined): number | null {
  if (c == null || Number.isNaN(c)) return null;
  return Math.round((c * 9) / 5 + 32);
}

export function normalizeOpenMeteoCurrent(
  locationKey: string,
  payload: any
): NormalizedReading {
  const cur = payload?.current ?? {};
  const temp =
    cur.temperature_2m != null
      ? Number(cur.temperature_2m)
      : cToF(payload?.current_weather?.temperature);
  return {
    locationKey,
    source: SOURCE_OPEN_METEO,
    kind: "current",
    observedAt: cur.time || payload?.current_weather?.time || new Date().toISOString(),
    tempF: temp != null ? Math.round(temp) : null,
    humidityPct: cur.relative_humidity_2m != null ? Math.round(cur.relative_humidity_2m) : null,
    windMph: cur.wind_speed_10m != null ? Number(cur.wind_speed_10m) : null,
    precipIn: cur.precipitation != null ? Number(cur.precipitation) : null,
    text: weatherCodeText(cur.weather_code),
    extra: { host: "api.open-meteo.com" },
  };
}

export function normalizeOpenMeteoForecastDay(
  locationKey: string,
  date: string,
  tempF: number | null,
  precipIn: number | null,
  windMph: number | null,
  weatherCode?: number
): NormalizedReading {
  return {
    locationKey,
    source: SOURCE_OPEN_METEO,
    kind: "forecast",
    observedAt: date,
    tempF,
    humidityPct: null,
    windMph,
    precipIn,
    text: weatherCodeText(weatherCode),
    extra: { host: "api.open-meteo.com" },
  };
}

export function normalizeNwsAlert(locationKey: string, alert: any): NormalizedReading {
  const p = alert?.properties ?? alert;
  return {
    locationKey,
    source: SOURCE_NWS,
    kind: "alert",
    observedAt: p.effective || p.onset || new Date().toISOString(),
    tempF: null,
    humidityPct: null,
    windMph: null,
    precipIn: null,
    text: p.headline || p.event || "NWS alert",
    extra: {
      host: "api.weather.gov",
      event: p.event,
      severity: p.severity,
      headline: p.headline,
    },
  };
}

export function normalizeIot(
  locationKey: string,
  sourceId: string,
  type: string,
  value: number,
  unit: string
): NormalizedReading {
  return {
    locationKey,
    source: SOURCE_IOT,
    kind: "iot",
    observedAt: new Date().toISOString(),
    tempF: type === "temperature" ? value : null,
    humidityPct: type === "humidity" ? value : null,
    windMph: type === "wind" ? value : null,
    precipIn: type === "precip" ? value : null,
    text: `Simulated IoT ${type} ${value}${unit} from ${sourceId}`,
    extra: { iotId: sourceId, type, unit, simulated: true },
  };
}

export function weatherCodeText(code?: number | null): string {
  if (code == null) return "conditions available";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Thunderstorms";
  return "Mixed";
}
