/**
 * Shared auth + CORS for the Express server (server/index.ts) and the Lambda app
 * (server/lambdaApp.ts).
 *
 * - DOC_MCP_TOKEN: bearer required on /mcp, /api/tools/:name and /api/public/chat.
 *   On AWS Lambda the server fails closed (503) if it is unset, so a deploy can never
 *   be silently open. Locally (no AWS_LAMBDA_FUNCTION_NAME) an unset token means open,
 *   for development only.
 * - ALLOWED_ORIGINS: extra browser origins (comma list) on top of whatsupdoc.fyi and
 *   localhost. Requests with no Origin (Alexa+, curl, server-to-server) are allowed
 *   through CORS but still need the bearer.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { CorsOptions } from "cors";

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
  if (!origin) return true; // non-browser MCP clients; bearer still required
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

/** Express middleware: require Authorization: Bearer <DOC_MCP_TOKEN>. */
export function requireBearer(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  const expected = (process.env.DOC_MCP_TOKEN || "").trim();
  if (!expected) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }
    next(); // local dev only
    return;
  }
  if (!tokenMatches(bearerFrom(req), expected)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="doc-ai"');
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
