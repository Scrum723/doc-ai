import { describe, expect, it } from "vitest";
import { ensureSeeded } from "../data/ingest.js";
import { distinctSources, historicalRange, latest, listIotSources } from "../data/db.js";
import {
  SOURCE_IOT,
  SOURCE_NWS,
  SOURCE_OPEN_METEO,
  normalizeIot,
  normalizeNwsAlert,
  normalizeOpenMeteoCurrent,
} from "../data/normalize.js";
import { getHistorical, getCurrentWeather, listIotSourcesTool } from "../agent/orchestrator.js";

describe("normalize + store (shipped)", () => {
  it("normalized model includes two API sources plus IoT", () => {
    const om = normalizeOpenMeteoCurrent("rochester", {
      current: { temperature_2m: 55, relative_humidity_2m: 70, wind_speed_10m: 6, weather_code: 0, time: "2026-09-18T12:00" },
    });
    const nws = normalizeNwsAlert("rochester", {
      properties: { event: "Wind Advisory", headline: "Wind Advisory", effective: "2026-09-18T12:00:00Z" },
    });
    const iot = normalizeIot("rochester", "iot-roc-dock-temp", "temperature", 51, "F");
    expect(om.source).toBe(SOURCE_OPEN_METEO);
    expect(nws.source).toBe(SOURCE_NWS);
    expect(iot.source).toBe(SOURCE_IOT);
    expect(new Set([om.source, nws.source, iot.source]).size).toBe(3);
  });

  it("seed-backed historical range returns stored rows", async () => {
    ensureSeeded();
    const rows = historicalRange("rochester", "2026-09-15", "2026-09-18T23:59:59");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.source === SOURCE_OPEN_METEO || r.source === SOURCE_IOT)).toBe(true);
    const viaTool = await getHistorical({
      location: "rochester",
      date_range: "2026-09-15 to 2026-09-18",
    });
    expect((viaTool.data.readings as any[]).length).toBeGreaterThan(0);
    expect(viaTool.spoken.toLowerCase()).toMatch(/reading|degrees|rochester/);
  });

  it("seed current and iot sources exist after ensureSeeded", async () => {
    ensureSeeded();
    const cur = latest("rochester", "current");
    expect(cur).not.toBeNull();
    expect(cur?.tempF).not.toBeNull();
    const sources = distinctSources();
    expect(sources).toEqual(expect.arrayContaining([SOURCE_OPEN_METEO, SOURCE_NWS, SOURCE_IOT]));
    const iot = listIotSources() as any[];
    expect(iot.length).toBeGreaterThan(0);
    const tool = await listIotSourcesTool({ location: "rochester" });
    expect(tool.data.simulated).toBe(true);
    const weather = await getCurrentWeather({ location: "rochester" });
    expect(weather.spoken.length).toBeGreaterThan(10);
  });
});
