# Devpost paste — Doc AI

**Title:** Doc AI — Alexa+ conversational weather agent

**Tagline:** Chat with global weather: APIs plus IoT sensors, stored and spoken through MCP.

**Primary track:** Alexa+ only (do not submit this project to a second primary track). AWS Builder + Open Source may be layered on the same entry.

**Description:**
Doc AI is a self-hosted MCP server (spec 2025-11-25, Streamable HTTP POST+GET on `/mcp`) that ingests Open-Meteo and National Weather Service data plus a simulated IoT sensor feed, normalizes it into SQLite, and answers Alexa+ in short spoken sentences. Tools: get_current_weather, get_forecast, get_alerts, get_historical, list_iot_sources, chat_summary. A web playground simulates Alexa+ without a device. Seed data keeps the demo honest when APIs are down. IoT is labeled simulation — not a fake live camera weather network.

**Built with:** MCP TypeScript SDK, Node.js, Express, SQLite, Open-Meteo, NWS api.weather.gov, AWS App Runner Dockerfile

**What's next:** Live IoT OAuth, App Runner hosting, watches with push alerts.

**Repo:** https://github.com/Scrum723/doc-ai (MIT)

**Demo script:** docs/demo-script.md
