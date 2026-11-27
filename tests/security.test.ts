import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { originAllowed, requireBearer, tokenMatches, corsOptions, originGuard, authMode } from "../server/security.js";
import cors from "cors";

async function withServer(fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(cors(corsOptions()));
  app.use(originGuard());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.post("/mcp", requireBearer, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("origin rules", () => {
  it("allows DOC sites, localhost, ALLOWED_ORIGINS and no-origin clients", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://partner.example");
    expect(originAllowed(undefined)).toBe(true);
    expect(originAllowed("https://whatsupdoc.fyi")).toBe(true);
    expect(originAllowed("https://app.whatsupdoc.fyi")).toBe(true);
    expect(originAllowed("http://localhost:3000")).toBe(true);
    expect(originAllowed("https://partner.example")).toBe(true);
  });
  it("rejects other origins, http subdomain spoofs and lookalikes", () => {
    expect(originAllowed("https://evil.example")).toBe(false);
    expect(originAllowed("https://whatsupdoc.fyi.evil.example")).toBe(false);
    expect(originAllowed("http://x.whatsupdoc.fyi")).toBe(false);
    expect(originAllowed("https://x.awsapprunner.com")).toBe(false);
  });
  it("allows the server's own host (demo UI)", () => {
    expect(originAllowed("https://abc.lambda-url.us-east-1.on.aws", { selfHost: "abc.lambda-url.us-east-1.on.aws" })).toBe(true);
  });
});

describe("tokenMatches", () => {
  it("compares safely", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches("", "abc")).toBe(false);
  });
});

describe("authMode", () => {
  it("defaults to off; accepts optional and required", () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "");
    expect(authMode()).toBe("off");
    vi.stubEnv("DOC_MCP_AUTH_MODE", "optional");
    expect(authMode()).toBe("optional");
    vi.stubEnv("DOC_MCP_AUTH_MODE", "REQUIRED");
    expect(authMode()).toBe("required");
    vi.stubEnv("DOC_MCP_AUTH_MODE", "weird");
    expect(authMode()).toBe("off");
  });
});

describe("DOC_MCP_AUTH_MODE off", () => {
  it("skips bearer check even when DOC_MCP_TOKEN is set", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "off");
    vi.stubEnv("DOC_MCP_TOKEN", "t0ken-xyz");
    await withServer(async (base) => {
      expect((await fetch(`${base}/mcp`, { method: "POST" })).status).toBe(200);
      expect(
        (await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer nope" } })).status,
      ).toBe(200);
    });
  });
});

describe("DOC_MCP_AUTH_MODE optional", () => {
  it("allows missing bearer and logs without the token value", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "optional");
    vi.stubEnv("DOC_MCP_TOKEN", "t0ken-xyz");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await withServer(async (base) => {
      expect((await fetch(`${base}/mcp`, { method: "POST" })).status).toBe(200);
      expect(warn).toHaveBeenCalled();
      const logged = warn.mock.calls.map((c) => JSON.stringify(c)).join("\n");
      expect(logged).toContain("request without bearer");
      expect(logged).not.toContain("t0ken-xyz");
      const ok = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer t0ken-xyz" } });
      expect(ok.status).toBe(200);
    });
  });
  it("rejects a wrong bearer", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "optional");
    vi.stubEnv("DOC_MCP_TOKEN", "t0ken-xyz");
    await withServer(async (base) => {
      const bad = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer nope" } });
      expect(bad.status).toBe(401);
      expect(await bad.text()).not.toContain("t0ken-xyz");
    });
  });
});

describe("DOC_MCP_AUTH_MODE required", () => {
  it("401 without or with a wrong token, 200 with the right one", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "required");
    vi.stubEnv("DOC_MCP_TOKEN", "t0ken-xyz");
    await withServer(async (base) => {
      expect((await fetch(`${base}/mcp`, { method: "POST" })).status).toBe(401);
      const bad = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer nope" } });
      expect(bad.status).toBe(401);
      expect(await bad.text()).not.toContain("t0ken-xyz");
      const ok = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer t0ken-xyz" } });
      expect(ok.status).toBe(200);
      expect((await fetch(`${base}/health`)).status).toBe(200);
    });
  });
  it("fails closed on Lambda when DOC_MCP_TOKEN is unset", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "required");
    vi.stubEnv("DOC_MCP_TOKEN", "");
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "doc-ai");
    await withServer(async (base) => {
      const r = await fetch(`${base}/mcp`, { method: "POST" });
      expect(r.status).toBe(503);
    });
  });
  it("is open locally when unset (dev only)", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "required");
    vi.stubEnv("DOC_MCP_TOKEN", "");
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    await withServer(async (base) => {
      expect((await fetch(`${base}/mcp`, { method: "POST" })).status).toBe(200);
    });
  });
  it("403 for a foreign browser origin; no CORS header", async () => {
    vi.stubEnv("DOC_MCP_AUTH_MODE", "required");
    vi.stubEnv("DOC_MCP_TOKEN", "t0ken-xyz");
    await withServer(async (base) => {
      const r = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { Origin: "https://evil.example", Authorization: "Bearer t0ken-xyz" },
      });
      expect(r.status).toBe(403);
      expect(r.headers.get("access-control-allow-origin")).toBeNull();
      const pre = await fetch(`${base}/mcp`, {
        method: "OPTIONS",
        headers: { Origin: "https://whatsupdoc.fyi", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" },
      });
      expect(pre.headers.get("access-control-allow-origin")).toBe("https://whatsupdoc.fyi");
      expect((pre.headers.get("access-control-allow-headers") || "").toLowerCase()).toContain("authorization");
    });
  });
});

describe("apps wire the guard", () => {
  it("lambdaApp and index protect /mcp, tools and chat", async () => {
    const { readFileSync } = await import("node:fs");
    const lam = readFileSync(new URL("../server/lambdaApp.ts", import.meta.url), "utf8");
    expect(lam).not.toContain("origin: true");
    expect(lam).toContain('app.post("/mcp", requireBearer');
    expect(lam).toContain('app.post("/api/tools/:name", requireBearer');
    expect(lam).toContain('app.post("/api/public/chat", requireBearer');
    const idx = readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
    expect(idx).toContain('app.use("/mcp", requireBearer)');
    expect(idx).toContain("requireBearer, async (req, res)");
  });
});
