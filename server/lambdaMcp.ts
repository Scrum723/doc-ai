/**
 * Lightweight Streamable-HTTP JSON MCP handler for AWS Lambda.
 * Avoids SDK Content-Type quirks under Function URL + serverless-http.
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { TOOL_NAMES, runTool } from "../agent/tools.js";

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

function ok(res: Response, id: JsonRpc["id"], result: unknown, sessionId?: string) {
  if (sessionId) res.setHeader("mcp-session-id", sessionId);
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ jsonrpc: "2.0", id: id ?? null, result });
}

function err(res: Response, id: JsonRpc["id"], code: number, message: string, status = 400) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function handleLambdaMcpPost(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as JsonRpc;
  const method = body.method || "";
  const id = body.id ?? null;
  const sessionHeader = req.headers["mcp-session-id"];
  let sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

  if (method === "initialize") {
    sessionId = sessionId || randomUUID();
    ok(
      res,
      id,
      {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "doc-ai", version: "1.0.0" },
      },
      sessionId
    );
    return;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    res.status(202).end();
    return;
  }

  if (method === "tools/list") {
    ok(
      res,
      id,
      {
        tools: TOOL_NAMES.map((name) => ({
          name,
          description: `Doc AI tool ${name}`,
          inputSchema: { type: "object", properties: { location: { type: "string" } } },
        })),
      },
      sessionId || undefined
    );
    return;
  }

  if (method === "tools/call") {
    const name = body.params?.name as string;
    const args = (body.params?.arguments || {}) as Record<string, unknown>;
    if (!name || !(TOOL_NAMES as readonly string[]).includes(name)) {
      err(res, id, -32601, `Unknown tool: ${name}`);
      return;
    }
    try {
      const out = await runTool(name, args);
      ok(
        res,
        id,
        {
          content: [{ type: "text", text: out.spoken }],
          structuredContent: out,
        },
        sessionId || undefined
      );
    } catch (e) {
      err(res, id, -32603, e instanceof Error ? e.message : String(e), 500);
    }
    return;
  }

  if (!method) {
    err(res, id, -32600, "Invalid Request: method required");
    return;
  }

  err(res, id, -32601, `Method not found: ${method}`);
}
