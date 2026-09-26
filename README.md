# Doc AI

Conversational weather agent for the **Amazon Developer Hackathon — Alexa+ track only**.

Doc AI absorbs public weather APIs plus simulated IoT sensors, stores normalized readings in SQLite, and exposes them through a self-hosted **MCP server (spec 2025-11-25, Streamable HTTP)** so Alexa+ can talk about current conditions, forecasts, alerts, and history in short spoken sentences.

This is **not** a rename of DOC Watch dock-advice tools. Doc AI is a first-release ingest/store/chat product with historical + IoT + `chat_summary`.

## One-command start

```bash
cd doc-ai
npm install
npm run dev
```

Then:

- Health: http://127.0.0.1:8790/health
- Alexa+ sim: http://127.0.0.1:8790/
- MCP: `POST` and `GET` http://127.0.0.1:8790/mcp

Tests: `npm test`

## MCP tools

| Tool | What it does |
|------|----------------|
| `get_current_weather` | Live Open-Meteo (seed fallback) |
| `get_forecast` | Daily forecast, `days` default 7 |
| `get_alerts` | NWS `api.weather.gov` alerts (seed fallback) |
| `get_historical` | Date-range query against stored readings |
| `list_iot_sources` | Simulated IoT nodes |
| `chat_summary` | Spoken briefing, no markdown |

## Data layer

- **Open-Meteo** `api.open-meteo.com` + archive `archive-api.open-meteo.com`
- **NWS** `api.weather.gov`
- **Simulated IoT** probes (labeled simulation — not a live worldwide camera mesh)
- **SQLite** (`data/doc-ai.sqlite`) seeded from `data/seed.json` so the demo works offline

## Folders

```
server/     MCP Streamable HTTP entry (POST + GET /mcp, Origin 403)
data/       ingest, normalize, SQLite, seed, IoT sim
agent/      voice formatter + tool orchestrator
deploy/     Dockerfile companion, App Runner script
docs/       product-feedback, friction log, Devpost paste, demo script
web/        simulated Alexa+ chat
```

## Deploy (AWS App Runner)

```bash
docker build -t doc-ai .
# or
bash deploy/deploy-apprunner.sh
```

Request AWS Builder credits if needed. Localhost bind is the default for the 3-minute demo.

## License

MIT. Public GitHub intended: https://github.com/Scrum723/doc-ai

If submitting private instead, share with `testing@devpost.com` and Amazon reviewers: chris-trag, knmeiss, giolaq, anishamalde, mosesroth, emersonsklar.

## Prior work

DOC / WFAD / SWAFT / DOC Watch are related weather-agent lineage. Doc AI is a new ingest-store-MCP surface (historical, IoT list, chat_summary, two-API SQLite), not a reskin of the locked DOC Watch dock-tool list.

Primary track: **Alexa+ only**.
