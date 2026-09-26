/**
 * Doc AI MCP Streamable HTTP server
 * Spec 2025-11-25 — single /mcp endpoint, POST + GET, Origin validation, localhost bind.
 * Official SDK: @modelcontextprotocol/sdk McpServer + StreamableHTTPServerTransport
 */
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ensureSeeded } from "../data/ingest.js";
import { registerTools, runTool, TOOL_NAMES } from "../agent/tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || "0.0.0.0";

function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
    "http://127.0.0.1",
    "http://localhost",
    "https://whatsupdoc.fyi",
    "https://www.whatsupdoc.fyi",
    "https://api.whatsupdoc.fyi",
    ...extra,
  ];
}

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // curl / MCP clients without browser Origin
  const list = allowedOrigins();
  if (list.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return (
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost" ||
      u.hostname.endsWith(".awsapprunner.com") ||
      u.hostname.endsWith(".whatsupdoc.fyi")
    );
  } catch {
    return false;
  }
}

function originGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin)) {
    console.warn(`[origin] 403 for ${origin}`);
    res.status(403).json({ error: "Forbidden origin", origin });
    return;
  }
  next();
}

function createDocAiServer(): McpServer {
  const server = new McpServer(
    { name: "doc-ai", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
  );
  registerTools(server);
  return server;
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

const publicBind = HOST === "0.0.0.0" || HOST === "::" || HOST === "::0";
const app = createMcpExpressApp(
  publicBind
    ? { host: "0.0.0.0" }
    : { host: HOST, allowedHosts: ["127.0.0.1", "localhost"] }
);
app.use(cors({ origin: (o, cb) => cb(null, originAllowed(o)) }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(join(__dirname, "../web")));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Doc AI",
    mcp: { transport: "streamable-http", protocol: "2025-11-25", endpoint: "/mcp", methods: ["POST", "GET"] },
    tools: TOOL_NAMES,
  });
});

app.get("/api/tools", (_req, res) => res.json({ tools: TOOL_NAMES }));

app.post("/api/tools/:name", async (req, res) => {
  try {
    const out = await runTool(req.params.name, req.body ?? {});
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message, spoken: `I could not run that tool. ${message}.` });
  }
});

app.use("/mcp", originGuard);

app.post("/mcp", async (req: Request, res: Response) => {
  console.log(`[MCP] POST /mcp method=${req.body?.method ?? "n/a"}`);
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          console.log(`[MCP] session ${id}`);
          transports[id] = transport;
        },
      });
      const server = createDocAiServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP] POST error", error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

// Spec 2025-11-25: GET on the same /mcp path for optional SSE (not a legacy /sse URL).
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports[sessionId]) {
    try {
      await transports[sessionId].handleRequest(req, res);
      return;
    } catch (error) {
      console.error("[MCP] GET session error", error);
    }
  }
  res.status(200).json({
    ok: true,
    service: "Doc AI",
    transport: "streamable-http",
    protocol: "2025-11-25",
    hint: "POST initialize with protocolVersion 2025-11-25. GET with mcp-session-id opens the SSE stream.",
    tools: TOOL_NAMES,
  });
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
  delete transports[sessionId];
});

ensureSeeded();

app.listen(PORT, HOST, () => {
  console.log(`Doc AI listening on http://${HOST}:${PORT}`);
  console.log(`MCP Streamable HTTP (2025-11-25) POST+GET http://${HOST}:${PORT}/mcp`);
  console.log(`Alexa+ sim: http://${HOST}:${PORT}/`);
  console.log(`Tools: ${TOOL_NAMES.join(", ")}`);
});
