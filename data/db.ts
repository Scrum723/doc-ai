/**
 * SQLite store for normalized weather + IoT readings.
 * Uses Node.js built-in node:sqlite (Node 22+).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NormalizedReading } from "./normalize.js";

// process.getBuiltinModule avoids Vite rewriting `node:sqlite` to a missing `sqlite` package.
type DatabaseSync = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): unknown;
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown[];
  };
  close(): void;
};
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (path: string) => DatabaseSync;
};

let db: DatabaseSync | null = null;

export function dbPath(): string {
  return (
    process.env.DOC_AI_DB ||
    join(process.env.AWS_LAMBDA_FUNCTION_NAME ? "/tmp" : process.cwd(), "data", "doc-ai.sqlite")
  );
}

export function getDb(): DatabaseSync {
  if (db) return db;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 8000;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_key TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      temp_f REAL,
      humidity_pct REAL,
      wind_mph REAL,
      precip_in REAL,
      text TEXT,
      extra_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_readings_loc_kind ON readings(location_key, kind, observed_at);
    CREATE TABLE IF NOT EXISTS iot_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location_key TEXT NOT NULL,
      type TEXT NOT NULL,
      lat REAL,
      lon REAL,
      unit TEXT
    );
  `);
  return db;
}

export function resetDbConnection(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

export function upsertReading(r: NormalizedReading): void {
  const d = getDb();
  d.prepare(
    `INSERT INTO readings (location_key, source, kind, observed_at, temp_f, humidity_pct, wind_mph, precip_in, text, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    r.locationKey,
    r.source,
    r.kind,
    r.observedAt,
    r.tempF,
    r.humidityPct,
    r.windMph,
    r.precipIn,
    r.text,
    JSON.stringify(r.extra ?? {})
  );
}

export function replaceKind(locationKey: string, kind: string, rows: NormalizedReading[]): void {
  const d = getDb();
  d.prepare(`DELETE FROM readings WHERE location_key = ? AND kind = ?`).run(locationKey, kind);
  for (const r of rows) upsertReading(r);
}

export function latest(locationKey: string, kind: string): NormalizedReading | null {
  const row = getDb()
    .prepare(
      `SELECT location_key, source, kind, observed_at, temp_f, humidity_pct, wind_mph, precip_in, text, extra_json
       FROM readings WHERE location_key = ? AND kind = ? ORDER BY observed_at DESC LIMIT 1`
    )
    .get(locationKey, kind) as any;
  return row ? fromRow(row) : null;
}

export function listByKind(locationKey: string, kind: string, limit = 24): NormalizedReading[] {
  const rows = getDb()
    .prepare(
      `SELECT location_key, source, kind, observed_at, temp_f, humidity_pct, wind_mph, precip_in, text, extra_json
       FROM readings WHERE location_key = ? AND kind = ? ORDER BY observed_at ASC LIMIT ?`
    )
    .all(locationKey, kind, limit) as any[];
  return rows.map(fromRow);
}

export function historicalRange(
  locationKey: string,
  startIso: string,
  endIso: string
): NormalizedReading[] {
  const rows = getDb()
    .prepare(
      `SELECT location_key, source, kind, observed_at, temp_f, humidity_pct, wind_mph, precip_in, text, extra_json
       FROM readings
       WHERE location_key = ?
         AND kind IN ('historical', 'iot')
         AND observed_at >= ?
         AND observed_at <= ?
       ORDER BY observed_at ASC`
    )
    .all(locationKey, startIso, endIso) as any[];
  return rows.map(fromRow);
}

export function distinctSources(): string[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT source FROM readings`)
    .all() as { source: string }[];
  return rows.map((r) => r.source);
}

export function upsertIotSource(s: {
  id: string;
  name: string;
  locationKey: string;
  type: string;
  lat: number;
  lon: number;
  unit: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO iot_sources (id, name, location_key, type, lat, lon, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, location_key=excluded.location_key`
    )
    .run(s.id, s.name, s.locationKey, s.type, s.lat, s.lon, s.unit);
}

export function listIotSources(locationKey?: string) {
  if (locationKey) {
    return getDb()
      .prepare(`SELECT * FROM iot_sources WHERE location_key = ?`)
      .all(locationKey);
  }
  return getDb().prepare(`SELECT * FROM iot_sources`).all();
}

function fromRow(row: any): NormalizedReading {
  return {
    locationKey: row.location_key,
    source: row.source,
    kind: row.kind,
    observedAt: row.observed_at,
    tempF: row.temp_f,
    humidityPct: row.humidity_pct,
    windMph: row.wind_mph,
    precipIn: row.precip_in,
    text: row.text,
    extra: row.extra_json ? JSON.parse(row.extra_json) : {},
  };
}
