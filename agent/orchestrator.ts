import { resolveLocation } from "../data/locations.js";
import {
  distinctSources,
  historicalRange,
  latest,
  listByKind,
  listIotSources,
} from "../data/db.js";
import { ensureSeeded, refreshHistorical, refreshLocation } from "../data/ingest.js";
import { joinSpoken, spoken } from "./voice.js";

export type ToolOut = { spoken: string; data: Record<string, unknown> };

function parseRange(dateRange?: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  if (!dateRange) {
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const m = dateRange.match(/(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/);
  if (m) return { start: m[1], end: m[2] };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange.trim())) {
    return { start: dateRange.trim(), end: dateRange.trim() };
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getCurrentWeather(args: { location?: string }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const refresh = await refreshLocation(loc);
  const row = latest(loc.key, "current");
  if (!row) {
    return {
      spoken: spoken(`I could not find current weather for ${loc.label}. ${refresh.errors.join(" ")}`),
      data: { error: true, location: loc, errors: refresh.errors },
    };
  }
  const line = joinSpoken([
    `Right now in ${loc.label} it is ${row.text.toLowerCase()} around ${row.tempF ?? "unknown"} degrees Fahrenheit.`,
    row.humidityPct != null ? `Humidity is ${row.humidityPct} percent.` : "",
    row.windMph != null ? `Wind is about ${row.windMph} miles per hour.` : "",
    refresh.errors.length ? `Live feed note: ${refresh.errors.join(". ")} Using stored readings.` : "",
  ]);
  return {
    spoken: line,
    data: { location: loc, reading: row, sources: distinctSources(), liveAttempt: refresh },
  };
}

export async function getForecast(args: { location?: string; days?: number }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const days = args.days ?? 3;
  await refreshLocation(loc, days);
  const rows = listByKind(loc.key, "forecast", days);
  if (!rows.length) {
    return {
      spoken: spoken(`I do not have a forecast stored for ${loc.label} yet.`),
      data: { error: true, location: loc },
    };
  }
  const first = rows[0];
  const rest = rows
    .slice(1, Math.min(3, rows.length))
    .map((r) => `${r.observedAt.slice(0, 10)} ${r.tempF} degrees, ${r.text.toLowerCase()}`);
  const line = joinSpoken([
    `${days} day forecast for ${loc.label} starts ${first.text.toLowerCase()} near ${first.tempF} degrees.`,
    rest.length ? `Next days: ${rest.join(". ")}.` : "",
  ]);
  return { spoken: line, data: { location: loc, days, forecast: rows } };
}

export async function getAlerts(args: { location?: string }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  await refreshLocation(loc);
  const rows = listByKind(loc.key, "alert", 20);
  if (!rows.length) {
    return {
      spoken: spoken(`There are no active weather alerts stored for ${loc.label} right now.`),
      data: { location: loc, alerts: [], count: 0 },
    };
  }
  const events = rows.map((r) => (r.extra as any)?.event || r.text).slice(0, 3);
  return {
    spoken: spoken(`${rows.length} alert${rows.length === 1 ? "" : "s"} for ${loc.label}. ${events.join(". ")}.`),
    data: { location: loc, alerts: rows, count: rows.length },
  };
}

export async function getHistorical(args: {
  location?: string;
  date_range?: string;
  dateRange?: string;
}): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const range = parseRange(args.date_range || args.dateRange);
  await refreshHistorical(loc, range.start, range.end);
  const rows = historicalRange(loc.key, range.start, range.end + "T23:59:59");
  if (!rows.length) {
    return {
      spoken: spoken(
        `No historical readings for ${loc.label} between ${range.start} and ${range.end}. Seed covers mid September 2026 for Rochester.`
      ),
      data: { location: loc, range, readings: [] },
    };
  }
  const temps = rows.map((r) => r.tempF).filter((t): t is number => t != null);
  const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  return {
    spoken: spoken(
      `I have ${rows.length} stored readings for ${loc.label} from ${range.start} to ${range.end}. Average high around ${avg ?? "unknown"} degrees.`
    ),
    data: { location: loc, range, readings: rows, sources: [...new Set(rows.map((r) => r.source))] },
  };
}

export async function listIotSourcesTool(args: { location?: string }): Promise<ToolOut> {
  ensureSeeded();
  const loc = args.location ? resolveLocation(args) : null;
  const sources = listIotSources(loc?.key) as any[];
  const names = sources.map((s) => s.name).join(", ");
  return {
    spoken: spoken(
      `Doc AI is watching ${sources.length} simulated IoT nodes${loc ? " near " + loc.label : ""}. ${names}. These are labeled simulations, not a live worldwide camera weather mesh.`
    ),
    data: { sources, location: loc, simulated: true },
  };
}

export async function chatSummary(args: { location?: string }): Promise<ToolOut> {
  const loc = resolveLocation(args);
  const current = await getCurrentWeather({ location: loc.key });
  const forecast = await getForecast({ location: loc.key, days: 3 });
  const alerts = await getAlerts({ location: loc.key });
  const iot = await listIotSourcesTool({ location: loc.key });
  const briefing = joinSpoken([
    `Here is your Doc AI briefing for ${loc.label}.`,
    current.spoken,
    forecast.spoken,
    alerts.spoken,
    iot.spoken,
  ]);
  return {
    spoken: briefing,
    data: {
      location: loc,
      current: current.data,
      forecast: forecast.data,
      alerts: alerts.data,
      iot: iot.data,
    },
  };
}
