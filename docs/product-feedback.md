# Product feedback — every tool, API, and SDK used

## @modelcontextprotocol/sdk (McpServer, StreamableHTTPServerTransport, createMcpExpressApp)

**Used for:** Self-hosted Alexa+ Agent Skill transport, spec 2025-11-25.

**Worked:** `registerTool` + JSON Streamable HTTP is a real runtime import, not a README mention. Session headers after initialize are reliable once you know them.

**Didn’t:** GET-on-same-path vs 405 JSON-mode examples; cryptic “no session ID”; Host vs Origin protection overlap.

**Onboarding:** Steep if you follow 2024 SSE tutorials.

**Use again:** Yes, for any Alexa+ skill.

## Open-Meteo (`api.open-meteo.com`, `archive-api.open-meteo.com`)

**Used for:** Current, forecast, historical ingest. No API key.

**Worked:** One URL family for current + daily forecast + archive. Units query params (`fahrenheit`, `mph`) are excellent for US voice.

**Didn’t:** US watches/warnings are not NWS-quality; archive lags a day.

**Onboarding:** Best of the free weather APIs we tried.

**Use again:** Yes.

## National Weather Service (`api.weather.gov`)

**Used for:** Alerts (second required public API).

**Worked:** Authoritative US alerts with `point=lat,lon`.

**Didn’t:** 403 without User-Agent; observation chain too heavy for a 3-minute voice demo.

**Onboarding:** Policy is tribal knowledge.

**Use again:** Yes, for alerts specifically.

## Simulated IoT feed (in-repo)

**Used for:** `list_iot_sources` + stored IoT historical rows.

**Worked:** Offline demo, clearly labeled simulation.

**Didn’t:** Easy to over-claim a live global mesh (we refused).

**Onboarding:** No official “weather IoT mock pack” from Ring/Alexa.

**Use again:** Yes as a fixture until Partner OAuth exists.

## Node `node:sqlite` + Express + Zod + tsx + Vitest

**Used for:** Store, HTTP, schemas, one-command `npm run dev`, tests.

**Worked:** Zero native sqlite binding on Node 22+. Vitest 2 is stable; Vitest 5 failed rolldown bindings on Windows.

**Use again:** Yes.

## AWS App Runner (Dockerfile + deploy script)

**Used for:** Deploy artifact. Live deploy not required to judge the MCP skill.

**Worked:** Dockerfile is straightforward Node 22.

**Didn’t:** Credits / IAM not exercised in this environment.

**Use again:** Yes for a hosted `/mcp`.
