# Devpost paste — Doc AI

**Title:** Doc AI — Alexa+ MCP weather Agent Skill

**Tagline:** Self-hosted MCP weather tools for Alexa+ — Alexa is the LLM, Doc AI is the data brain.

**Primary track:** Alexa+ only.

**Description:**
Doc AI is a free-standing self-hosted MCP server (spec 2025-11-25, Streamable HTTP on `/mcp`) for the Alexa+ track. It ingests Open-Meteo and National Weather Service data plus a simulated IoT feed into SQLite and exposes six callable tools: get_current_weather, get_forecast, get_alerts, get_historical, list_iot_sources, chat_summary. Tools return structured JSON and short spoken fact strings. **There is no Grok or third-party LLM in this submission** — Alexa / Alexa+ provides the language model and conversation. A thin web simulator shows tool routing for the demo video. Hosted cheaply on AWS Lambda Function URL.

**Built with:** MCP TypeScript SDK, Node.js, Express, SQLite, Open-Meteo, NWS api.weather.gov, AWS Lambda

**What's next:** Live Alexa+ skill registration, IoT OAuth mesh, watches.

**Repo:** https://github.com/Scrum723/doc-ai (MIT)
