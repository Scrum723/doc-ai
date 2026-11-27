/**
 * Shared auth + CORS for the Express server (server/index.ts) and the Lambda app
 * (server/lambdaApp.ts).
 *
 * - DOC_MCP_AUTH_MODE: off | optional | required (default off).
 *   off: no bearer check. optional: allow missing bearer (log once per request, never the
 *   token value); validate when present. required: reject without a valid bearer.
 * - DOC_MCP_TOKEN: expected bearer for /mcp, /api/tools/:name and /api/public/chat.
 *   Under required mode on AWS Lambda, unset token → 503 so a deploy is never silently open.
 *   Locally (no AWS_LAMBDA_FUNCTION_NAME) an unset token under required stays open (dev only).
 * - ALLOWED_ORIGINS: extra browser origins (comma list) on top of whatsupdoc.fyi and
 *   localhost. Requests with no Origin (Alexa+, curl, server-to-server) are allowed
 *   through CORS but still need the bearer when mode requires it.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { CorsOptions } from "cors";

export type AuthMode = "off" | "optional" | "required";

export function authMode(): AuthMode {
  const m = (process.env.DOC_MCP_AUTH_MODE || "off").trim().toLowerCase();
  if (m === "optional" || m === "required" || m === "off") return m;
  return "off";
}

export function allowedOrigins(port?: number): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const local = port ? [`http://127.0.0.1:${port}`, `http://localhost:${port}`] : [];
  return [
    ...local,
    "http://127.0.0.1",
    "http://localhost",
    "https://whatsupdoc.fyi",
    "https://www.whatsupdoc.fyi",
    "https://api.whatsupdoc.fyi",
    ...extra,
  ];
}

export function originAllowed(origin: string | undefined, opts: { port?: number; selfHost?: string } = {}): boolean {
  if (!origin) return true; // non-browser MCP clients; bearer still required when mode says so
  if (allowedOrigins(opts.port).includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (opts.selfHost && u.host === opts.selfHost) return true; // same-origin demo UI
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      (u.protocol === "https:" && u.hostname.endsWith(".whatsupdoc.fyi"))
    );
  } catch {
    return false;
  }
}

export function corsOptions(port?: number): CorsOptions {
  return {
    origin: (o, cb) => cb(null, originAllowed(o, { port })),
    exposedHeaders: ["mcp-session-id", "Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "mcp-session-id", "MCP-Protocol-Version"],
  };
}

/** Express middleware: 403 for disallowed browser origins (same host is allowed). */
export function originGuard(port?: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin, { port, selfHost: String(req.headers.host || "") })) {
      res.status(403).json({ error: "forbidden_origin" });
      return;
    }
    next();
  };
}

/** SHA-256 digests are fixed-length so timingSafeEqual always gets equal-length buffers. */
function digest(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

export function tokenMatches(presented: string, expected: string): boolean {
  if (!presented || !expected) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

function bearerFrom(req: Request): string {
  const h = String(req.headers.authorization || "");
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}

/** Express middleware: Authorization: Bearer <DOC_MCP_TOKEN> per DOC_MCP_AUTH_MODE. */
export function requireBearer(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const mode = authMode();
  if (mode === "off") {
    next();
    return;
  }
  const expected = (process.env.DOC_MCP_TOKEN || "").trim();
  if (!expected) {
    if (mode === "required" && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }
    next(); // optional, or required on local dev only
    return;
  }
  const presented = bearerFrom(req);
  if (!presented) {
    if (mode === "optional") {
      console.warn("[auth] request without bearer", { method: req.method, path: req.path });
      next();
      return;
    }
    res.setHeader("WWW-Authenticate", 'Bearer realm="doc-ai"');
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!tokenMatches(presented, expected)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="doc-ai"');
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
