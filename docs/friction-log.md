# Friction log — Doc AI (Alexa+ judging bonus)

Each entry: task, steps, expected vs actual, severity, workaround, suggestion.

---

## Issue 1 — MCP Streamable HTTP session after initialize

**Task:** Wire a self-hosted MCP server to spec 2025-11-25 Streamable HTTP so Alexa+ `tools/list` works.

**Steps:**
1. POST `/mcp` `initialize` with `protocolVersion: 2025-11-25` and `Accept: application/json, text/event-stream`.
2. POST `/mcp` `tools/list` without extra headers.
3. Repeat with `mcp-session-id` from initialize.

**Expected:** Follow-up `tools/list` succeeds on the same `/mcp` path.

**Actual:** JSON-RPC `-32000 Bad Request: No valid session ID` if `mcp-session-id` is omitted. Older blogs still document `/sse` + `/messages`. Some SDK JSON-mode samples return **405** on GET, which would fail “GET on the same path” for 2025-11-25.

**Severity:** High — blocks Alexa+ compliance and first-time onboarding.

**Workaround:** Stateful `StreamableHTTPServerTransport` with session map; GET `/mcp` accepted (SSE if session present, otherwise 200 capability JSON — never a second `/sse` URL). Smoke script in `deploy/mcp-smoke.mjs`.

**Suggestion:** Official Alexa+ MCP quickstart: initialize → copy session header → tools/list → tools/call, plus “GET is the SSE channel on the same path.”

---

## Issue 2 — NWS 403 without User-Agent

**Task:** Ingest a second free weather API for alerts (`api.weather.gov`) alongside Open-Meteo.

**Steps:**
1. `GET https://api.weather.gov/alerts/active?point=43.255,-77.685`.
2. Omit `User-Agent`.
3. Retry with a descriptive UA.

**Expected:** JSON GeoJSON alerts, or a clear error that names the missing header.

**Actual:** HTTP **403** with a short/HTML body that does **not** say “descriptive User-Agent required.” Looks like auth or geo-block. Current observations are also a 3-hop chain (we used Open-Meteo for current to avoid that, NWS for alerts only).

**Severity:** Medium — silent-looking ingest failure; demo would show empty alerts without seed.

**Workaround:** Always send `NWS_USER_AGENT`. Seed SQLite alerts so offline demo still speaks. Log every NWS URL. Visible errors, never empty success.

**Suggestion:** NWS should return `403 { "error": "User-Agent required", "docs": "..." }` instead of a bare 403.

---

## Issue 3 — Origin / DNS-rebinding vs local playground

**Task:** Bind MCP to localhost with Origin validation (invalid Origin → HTTP 403) while still serving the Alexa+ web sim.

**Steps:**
1. `createMcpExpressApp({ host: '127.0.0.1' })`.
2. Open `http://127.0.0.1:8790/` chat UI.
3. POST `/mcp` with `Origin: http://evil.example`.
4. curl `/mcp` with no Origin (MCP client).

**Expected:** Browser same-origin works; evil Origin 403; curl without Origin still initializes.

**Actual:** SDK localhost DNS-rebinding protection and CORS defaults can 403 **Host** or **Origin** in ways that also break LAN demos (`0.0.0.0`) or confuse “no Origin” clients. Docs mix Host-header checks with Origin checks.

**Severity:** Medium — easy to fail either the 403 test or the live demo.

**Workaround:** Explicit `/mcp` Origin middleware: missing Origin allowed (CLI/MCP), localhost Origins allowed, anything else **403**. Playground uses same-origin `/api/tools` so the 3-minute video does not depend on browser MCP CORS.

**Suggestion:** Document three cases in the SDK: no Origin, localhost Origin, disallowed Origin → 403, plus App Runner `ALLOWED_ORIGINS`.

---

(Bonus observed, not counted as one of the three: Vitest 5/rolldown missing native bindings on this Windows Node — pin vitest@2.)
