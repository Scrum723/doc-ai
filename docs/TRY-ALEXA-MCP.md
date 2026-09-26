# Try Doc AI as an Alexa+ MCP (no Grok)

**LLM = Alexa / Alexa+.** This server is free-standing MCP weather tools for the Alexa+ hackathon track. It does not call Grok, Bedrock, or any other chat model.

## Live AWS endpoint (Lambda Function URL)

- Base: https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws/
- Health: …/health
- MCP: `POST …/mcp` (protocol 2025-11-25)
- Chat UI on `/` is a **simulator** that routes phrases to tools (not an LLM)

```powershell
cd C:\Users\cclot\doc-ai
node deploy/mcp-smoke.mjs https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws
```

## Local

```powershell
cd C:\Users\cclot\doc-ai
npm run dev
# http://127.0.0.1:8790/mcp
```

## Alexa+ wiring

Point the Alexa+ Agent Skill / self-hosted MCP config at:

`https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws/mcp`

Alexa+ calls `tools/list` and `tools/call`. Doc AI returns spoken fact strings + JSON. Alexa+ generates the conversation.

## Cost

AWS credits pay for Lambda only. No LLM token spend on this service.
