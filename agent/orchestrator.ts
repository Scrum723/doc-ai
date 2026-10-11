import { resolveLocation } from "../data/locations.js";
import {
  confirmWatch,
  distinctSources,
  historicalRange,
  latest,
  listByKind,
  listIotSources,
  listWatches,
  proposeWatch,
  type WatchRow,
} from "../data/db.js";
import { ensureSeeded, refreshHistorical, refreshLocation } from "../data/ingest.js";
import type { GlanceCard } from "./card.js";
import { decideShouldI, parseActivity, type ShouldIFacts } from "./shouldI.js";
import { joinSpoken, spoken, spokenLead } from "./voice.js";

export type ToolOut = { spoken: string; data: Record<string, unknown>; card: GlanceCard };

function card(partial: GlanceCard): GlanceCard {
  return partial;
}

function unknownDesk(loc: { label: string; unknown?: boolean }): ToolOut | null {
  if (!loc.unknown) return null;
  return {
    spoken: spoken(
      `I don't have a live desk for ${loc.label} yet. Try Rochester, Fairport, or Long Pond — or name that city on Talk to DOC.`
    ),
    data: { error: true, unknown_place: true, location: loc },
    card: card({ headline: "Which place?", supporting: loc.label }),
  };
}

function overnightLow(locationKey: string): number | null {
  const days = listByKind(locationKey, "forecast", 3);
  const mins = days
    .map((r) => {
      const extraMin = (r.extra as { minTempF?: number | null } | undefined)?.minTempF;
      return extraMin ?? null;
    })
    .filter((n): n is number => n != null);
  if (mins.length) return Math.min(...mins);
  const highs = days.map((r) => r.tempF).filter((n): n is number => n != null);
  if (!highs.length) return null;
  return Math.min(...highs) - 10;
}

function alertEvents(locationKey: string): string[] {
  return listByKind(locationKey, "alert", 20).map((r) => String((r.extra as any)?.event || r.text));
}

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
  const miss = unknownDesk(loc);
  if (miss) return miss;
  const refresh = await refreshLocation(loc);
  const row = latest(loc.key, "current");
  if (!row) {
    return {
      spoken: spoken(`I could not find current weather for ${loc.label}. ${refresh.errors.join(" ")}`),
      data: { error: true, location: loc, errors: refresh.errors },
      card: card({ headline: "—", supporting: loc.label }),
    };
  }
  const extra = joinSpoken([
    row.humidityPct != null ? `Humidity ${row.humidityPct} percent.` : "",
    row.windMph != null ? `Wind around ${row.windMph} miles an hour.` : "",
    refresh.errors.length ? `Using a stored reading while the live feed catches up.` : "",
  ]);
  const line = spokenLead(loc.label, row.tempF, row.text.toLowerCase(), extra);
  return {
    spoken: line,
    data: { location: loc, reading: row, sources: distinctSources(), liveAttempt: refresh },
    card: card({
      headline: row.tempF != null ? `${row.tempF}°` : "—",
      supporting: `${row.text} · ${loc.label}`,
      chip: row.windMph != null ? `${row.windMph} mph` : undefined,
    }),
  };
}

export async function getForecast(args: { location?: string; days?: number }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const miss = unknownDesk(loc);
  if (miss) return miss;
  const days = args.days ?? 3;
  await refreshLocation(loc, days);
  const rows = listByKind(loc.key, "forecast", days);
  if (!rows.length) {
    return {
      spoken: spoken(`I do not have a forecast stored for ${loc.label} yet.`),
      data: { error: true, location: loc },
      card: card({ headline: "Forecast", supporting: loc.label }),
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
  return {
    spoken: line,
    data: { location: loc, days, forecast: rows },
    card: card({
      headline: first.tempF != null ? `${first.tempF}°` : "Forecast",
      supporting: `${days}-day outlook · ${loc.label}`,
      chip: first.text,
    }),
  };
}

export async function getAlerts(args: { location?: string }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const miss = unknownDesk(loc);
  if (miss) return miss;
  await refreshLocation(loc);
  const rows = listByKind(loc.key, "alert", 20);
  if (!rows.length) {
    return {
      spoken: spoken(`There are no active weather alerts stored for ${loc.label} right now.`),
      data: { location: loc, alerts: [], count: 0 },
      card: card({ headline: "No alerts", supporting: loc.label, chip: "Clear" }),
    };
  }
  const events = rows.map((r) => (r.extra as any)?.event || r.text).slice(0, 3);
  return {
    spoken: spoken(`${rows.length} alert${rows.length === 1 ? "" : "s"} for ${loc.label}. ${events.join(". ")}.`),
    data: { location: loc, alerts: rows, count: rows.length },
    card: card({
      headline: String(events[0] || "Alert"),
      supporting: `${rows.length} active · ${loc.label}`,
      chip: "NWS",
    }),
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
      card: card({ headline: "No history", supporting: `${range.start} to ${range.end}` }),
    };
  }
  const temps = rows.map((r) => r.tempF).filter((t): t is number => t != null);
  const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  return {
    spoken: spoken(
      `I have ${rows.length} stored readings for ${loc.label} from ${range.start} to ${range.end}. Average high around ${avg ?? "unknown"} degrees.`
    ),
    data: { location: loc, range, readings: rows, sources: [...new Set(rows.map((r) => r.source))] },
    card: card({
      headline: avg != null ? `${avg}°` : "History",
      supporting: `${rows.length} readings · ${range.start} to ${range.end}`,
    }),
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
    card: card({
      headline: `${sources.length} nodes`,
      supporting: "Simulated IoT · not a live camera mesh",
      chip: "MOCK",
    }),
  };
}

function watchLine(locLabel: string, locationKey: string, watches: WatchRow[]): string {
  if (!watches.length) return "";
  const freeze = watches.find((w) => w.hazard === "freeze");
  const others = watches.filter((w) => w.hazard !== "freeze");
  const parts: string[] = [];
  if (freeze) {
    const low = overnightLow(locationKey);
    const events = alertEvents(locationKey).join(" ").toLowerCase();
    const nwsFreeze = /freeze|frost/.test(events);
    if (freeze.status === "pending") {
      parts.push(`A freeze watch for ${locLabel} is waiting for your confirm.`);
    } else if (nwsFreeze) {
      parts.push(`Freeze watch is active. NWS has a freeze or frost product for ${locLabel}.`);
    } else {
      parts.push(
        `Freeze watch is active for ${locLabel}. Overnight low around ${low ?? "unknown"} degrees. No freeze warning from NWS right now.`
      );
    }
  }
  for (const w of others) {
    parts.push(
      w.status === "pending"
        ? `A ${w.hazard} watch is waiting for your confirm.`
        : `${w.hazard} watch is active.`
    );
  }
  return parts.join(" ");
}

export async function chatSummary(args: { location?: string }): Promise<ToolOut> {
  const loc = resolveLocation(args);
  const miss = unknownDesk(loc);
  if (miss) return miss;
  const current = await getCurrentWeather({ location: loc.key });
  const forecast = await getForecast({ location: loc.key, days: 3 });
  const alerts = await getAlerts({ location: loc.key });
  const iot = await listIotSourcesTool({ location: loc.key });
  const watches = listWatches(loc.key);
  const watchSpoken = watchLine(loc.label, loc.key, watches);
  const briefing = joinSpoken([
    current.spoken,
    forecast.spoken,
    alerts.spoken,
    watchSpoken,
    iot.spoken,
  ]);
  const temp = (current.data.reading as { tempF?: number } | undefined)?.tempF;
  return {
    spoken: briefing,
    data: {
      location: loc,
      current: current.data,
      forecast: forecast.data,
      alerts: alerts.data,
      iot: iot.data,
      watches,
    },
    card: card({
      headline: temp != null ? `${temp}°` : "Briefing",
      supporting: loc.label,
      chip: watches.some((w) => w.status === "active")
        ? "Watch on"
        : watches.some((w) => w.status === "pending")
          ? "Confirm watch"
          : (alerts.data.count as number) > 0
            ? "Alerts"
            : "Clear",
    }),
  };
}

export function parseHazard(raw?: string): string {
  const s = (raw || "freeze").toLowerCase();
  if (/wind|gale/.test(s)) return "wind";
  if (/flood/.test(s)) return "flood";
  if (/rain|storm/.test(s)) return "rain";
  return "freeze";
}

export async function watchConditions(args: {
  location?: string;
  hazard?: string;
  confirm?: boolean;
}): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  const hazard = parseHazard(args.hazard);
  const confirmed = args.confirm === true || (args as { confirm?: unknown }).confirm === "true";
  const existing = listWatches(loc.key).find((w) => w.hazard === hazard);
  if (!confirmed && existing?.status === "active") {
    return {
      spoken: spoken(`${hazard} watch is already on for ${loc.label}. It is included in the briefing.`),
      data: { location: loc, watch: existing, confirmed: true },
      card: card({
        headline: `${hazard} watch on`,
        supporting: loc.label,
        chip: "Active",
      }),
    };
  }
  if (confirmed) {
    const row = confirmWatch(loc.key, hazard);
    const low = overnightLow(loc.key);
    return {
      spoken: spoken(
        `${hazard} watch is on for ${loc.label}. I will include it in the next briefing. Overnight low around ${low ?? "unknown"} degrees.`
      ),
      data: { location: loc, watch: row, confirmed: true },
      card: card({
        headline: `${hazard} watch on`,
        supporting: loc.label,
        chip: "Active",
        action: "Included in briefings",
      }),
    };
  }
  const row = proposeWatch(loc.key, hazard);
  return {
    spoken: spoken(
      `I will include ${hazard} in the next briefing for ${loc.label}. Confirm?`
    ),
    data: { location: loc, watch: row, needsConfirm: true, proposed: { location: loc.key, hazard } },
    card: card({
      headline: `Watch ${hazard}?`,
      supporting: loc.label,
      chip: "Pending",
      action: "Confirm",
      needsConfirm: true,
    }),
  };
}

function factsFor(locationKey: string, locationLabel: string): ShouldIFacts {
  const current = latest(locationKey, "current");
  const forecast = listByKind(locationKey, "forecast", 3);
  return {
    locationLabel,
    tempF: current?.tempF ?? null,
    minTempF: overnightLow(locationKey),
    windMph: current?.windMph ?? null,
    precipIn: current?.precipIn ?? null,
    conditionText: current?.text || "",
    forecastTexts: forecast.map((r) => r.text),
    forecastPrecip: forecast.map((r) => r.precipIn ?? 0),
    alertEvents: alertEvents(locationKey),
  };
}

export async function shouldI(args: { location?: string; activity?: string }): Promise<ToolOut> {
  ensureSeeded();
  const loc = resolveLocation(args);
  await refreshLocation(loc);
  const activity = parseActivity(args.activity);
  const decided = decideShouldI(activity, factsFor(loc.key, loc.label));
  return {
    spoken: decided.spoken,
    data: {
      location: loc,
      activity: decided.activity,
      decision: decided.decision,
      title: decided.title,
      reason: decided.reason,
      action: decided.action,
      card: decided.card,
    },
    card: decided.card,
  };
}
