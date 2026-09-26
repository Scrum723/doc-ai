/**
 * Slim Express app for AWS Lambda — no MCP SDK (avoids esbuild class breakage).
 * Exposes /health, /api/tools/*, Alexa UI, and JSON Streamable-HTTP /mcp.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { ensureSeeded } from "../data/ingest.js";
import { TOOL_NAMES, runTool } from "../agent/tools.js";
import { handleLambdaMcpPost } from "./lambdaMcp.js";

process.env.DOC_AI_DB = process.env.DOC_AI_DB || "/tmp/doc-ai.sqlite";

ensureSeeded();

export const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const webRoot = [join(process.cwd(), "web"), join("/var/task", "web")].find((p) => existsSync(p));
if (webRoot) app.use(express.static(webRoot));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Doc AI",
    host: "aws-lambda",
    mcp: {
      transport: "streamable-http-json",
      protocol: "2025-11-25",
      endpoint: "/mcp",
      methods: ["POST", "GET"],
    },
    tools: TOOL_NAMES,
    llm: "alexa-plus",
    note: "No Grok/xAI in this service. Alexa+ is the LLM; Doc AI is MCP tools only.",
  });
});

app.get("/api/tools", (_req, res) => res.json({ tools: TOOL_NAMES }));

app.post("/api/tools/:name", async (req: Request, res: Response) => {
  try {
    const out = await runTool(req.params.name, req.body ?? {});
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message, spoken: `I could not run that tool. ${message}.` });
  }
});

app.post("/mcp", async (req, res) => {
  await handleLambdaMcpPost(req, res);
});

app.get("/mcp", (_req, res) => {
  res.json({
    ok: true,
    service: "Doc AI",
    transport: "streamable-http-json",
    protocol: "2025-11-25",
    tools: TOOL_NAMES,
  });
});
