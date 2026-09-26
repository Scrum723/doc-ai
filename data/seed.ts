import { loadSeed } from "./locations.js";
import { getDb, replaceKind, upsertIotSource, upsertReading } from "./db.js";
import { SOURCE_IOT, SOURCE_NWS, SOURCE_OPEN_METEO } from "./normalize.js";

/** Load seed JSON into SQLite so tools work offline. */
export function seedDatabase(): void {
  getDb();
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

  for (const [key, cur] of Object.entries(seed.seedCurrent) as any) {
    replaceKind(key, "current", [
      {
        locationKey: key,
        source: SOURCE_OPEN_METEO,
        kind: "current",
        observedAt: new Date().toISOString(),
        tempF: cur.tempF,
        humidityPct: cur.humidityPct,
        windMph: cur.windMph,
        precipIn: 0,
        text: cur.text,
        extra: { seeded: true, host: "api.open-meteo.com" },
      },
    ]);
  }

  for (const [key, days] of Object.entries(seed.seedForecast) as any) {
    replaceKind(
      key,
      "forecast",
      days.map((d: any) => {
        const date = new Date();
        date.setDate(date.getDate() + d.dayOffset);
        return {
          locationKey: key,
          source: SOURCE_OPEN_METEO,
          kind: "forecast" as const,
          observedAt: date.toISOString().slice(0, 10),
          tempF: d.tempF,
          humidityPct: null,
          windMph: d.windMph,
          precipIn: d.precipIn,
          text: d.text,
          extra: { seeded: true, host: "api.open-meteo.com" },
        };
      })
    );
  }

  const alertsByLoc = new Map<string, any[]>();
  for (const a of seed.seedAlerts) {
    const list = alertsByLoc.get(a.locationKey) || [];
    list.push({
      locationKey: a.locationKey,
      source: SOURCE_NWS,
      kind: "alert" as const,
      observedAt: new Date().toISOString(),
      tempF: null,
      humidityPct: null,
      windMph: null,
      precipIn: null,
      text: a.headline,
      extra: { event: a.event, severity: a.severity, seeded: true, host: "api.weather.gov" },
    });
    alertsByLoc.set(a.locationKey, list);
  }
  for (const [key, rows] of alertsByLoc) replaceKind(key, "alert", rows);

  for (const h of seed.historical) {
    upsertReading({
      locationKey: h.locationKey,
      source: h.source === "iot" ? SOURCE_IOT : SOURCE_OPEN_METEO,
      kind: "historical",
      observedAt: h.date,
      tempF: h.tempF,
      humidityPct: h.humidityPct,
      windMph: h.windMph,
      precipIn: h.precipIn,
      text: h.text,
      extra: { seeded: true, host: h.source === "iot" ? "simulated-iot" : "archive-api.open-meteo.com" },
    });
  }

  console.log("[seed] SQLite ready with Open-Meteo, NWS, and IoT rows");
}

const isMain = process.argv[1]?.includes("seed");
if (isMain) seedDatabase();
