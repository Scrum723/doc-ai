# Winning submission guide — Doc AI (Alexa+ track)

**Deadline:** Friday, October 23, 2026 @ 12:00 pm Pacific  
**Track:** Alexa+  
**Repos:** https://github.com/Scrum723/doc-ai (MIT)  
**Live MCP (already on AWS):** https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws/  
**Talk / globe demo:** https://whatsupdoc.fyi/doc  

---

## 1. Important truth first

A home Echo **cannot** find “DOC Weather.” That is normal.

Amazon’s Alexa+ add-on tools (real device linking, MCP Toolkit, official Web Simulator) are **partner-only**. Hackathon FAQ: participants demo a **self-hosted MCP** through **your own web page** that acts as a real MCP client (`initialize` → `tools/list` → `tools/call`).

So for judging:

| Do this | Skip this |
| --- | --- |
| Show the live Lambda MCP + web sim / Talk to DOC | Asking a living-room Echo to “open DOC Weather” |
| Say “Alexa+ is the LLM; Doc AI is MCP tools” | Claiming a published Skills Store skill |
| Keep the video under 3 minutes, English, public YouTube/Vimeo | Third-party trademarks without permission |

---

## 2. What is already live on AWS

Even if you have not clicked around the console yourself, the project was already deployed:

| Piece | Status |
| --- | --- |
| AWS account | `594729247690` (us-east-1) |
| Lambda function | `doc-ai-mcp` |
| Public Function URL | `https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws/` |
| Health | `/health` → `"ok": true`, `"host": "aws-lambda"` |
| MCP | `/mcp` Streamable HTTP, protocol `2025-11-25` |
| Echo Show–style sim | Same URL `/` (HTTP 200) |
| Tools | `get_current_weather`, `get_forecast`, `get_alerts`, `get_historical`, `list_iot_sources`, `chat_summary`, `should_i`, `watch_conditions` |

**Your job on AWS for the video:** log in, verify, optionally refresh the code. You do **not** need to invent a new stack from zero unless you want a clean rebuild.

---

## 3. Step-by-step: set up / verify AWS (console)

### A. Sign in and land in the right place

1. Open https://console.aws.amazon.com/
2. Sign in as the account that owns Doc AI (contact on the account is Charles Clottin / `cclottin`).
3. Top-right region → **US East (N. Virginia) `us-east-1`**. Wrong region = empty Lambda list.
4. Search bar → type **Lambda** → open **Lambda**.

### B. Confirm the function exists

1. Open **Functions**.
2. Click **`doc-ai-mcp`**.
3. Check:
   - **Runtime:** Node.js 22.x  
   - **Architecture:** arm64  
   - **Memory:** 512 MB  
   - **Timeout:** 30 seconds  
   - **State:** Active  

If the function is missing, jump to section 4 (rebuild).

### C. Confirm the public Function URL

1. On the function page → **Configuration** → **Function URL**.
2. You should see a URL like:  
   `https://….lambda-url.us-east-1.on.aws/`
3. **Auth type:** `NONE` (public for the hackathon demo).
4. Open these in a browser:
   - `…/health` → JSON with `"ok": true`
   - `…/` → Echo Show–style sim page
   - `…/mcp` → MCP endpoint (POST from clients)

### D. Confirm invoke permissions (if health is 403)

1. **Configuration** → **Permissions** → resource-based policy.
2. You need both for principal `*`:
   - `lambda:InvokeFunctionUrl`
   - `lambda:InvokeFunction`  
   Function URL alone is not enough; without `InvokeFunction` you get 403.

### E. Confirm environment variables

**Configuration** → **Environment variables**. Typical:

- `DOC_AI_DB=/tmp/doc-ai.sqlite`
- `ALLOWED_ORIGINS` includes `https://whatsupdoc.fyi` (and localhost if you test locally)

### F. Optional: refresh AWS CLI on your PC

Your CLI session can expire (`aws login` / SSO). That does **not** mean Lambda is down. The Function URL health check is the source of truth for “is it live.”

```powershell
aws login
# or: aws sso login
aws sts get-caller-identity
aws lambda get-function-configuration --function-name doc-ai-mcp --region us-east-1
```

### G. Optional AWS Builder mini-challenge

Only if you want the extra prize track: document that Doc AI runs on **AWS Lambda** (Function URL). That already counts as using AWS. You do **not** need Bedrock for Alexa+ eligibility.

---

## 4. From-scratch rebuild (only if the function is gone)

Do this on a machine with Node 22+, AWS CLI logged in, and the repo at `C:\Users\cclot\doc-ai`.

```powershell
cd C:\Users\cclot\doc-ai
npm test
npm run build:lambda
# produces dist-lambda.zip

aws lambda update-function-code `
  --function-name doc-ai-mcp `
  --zip-file fileb://dist-lambda.zip `
  --region us-east-1
```

If creating the function for the first time (not just updating):

1. Create IAM role `doc-ai-lambda-role` with basic Lambda execution.
2. Create function `doc-ai-mcp`, runtime `nodejs22.x`, arch `arm64`, 512 MB, 30 s, handler from the zip.
3. Create Function URL, auth `NONE`, CORS `AllowMethods=*`.
4. Add resource policy statements for `InvokeFunctionUrl` + `InvokeFunction` for `*`.
5. Set env vars via a JSON file (commas in `ALLOWED_ORIGINS` break some CLI one-liners).
6. Smoke:

```powershell
curl https://YOUR-URL.lambda-url.us-east-1.on.aws/health
node deploy/mcp-smoke.mjs
```

Full notes: `docs/TRY-ALEXA-MCP.md`, memory/deploy comments in the repo.

---

## 5. What to open while you record

**Primary (recommended for judges):**

1. Live sim: https://cub7un5uilxww5uvdef6vjbkqm0ltpiq.lambda-url.us-east-1.on.aws/  
2. Optional second window: https://whatsupdoc.fyi/doc (Talk + globe)  
3. Optional third: AWS Lambda console showing `doc-ai-mcp` Active + Function URL  

**Say once, clearly:**

> “Alexa+ is the language model. Doc AI is a self-hosted MCP server on AWS Lambda. Participants cannot link real Echo devices to Alexa+ add-ons yet, so this web client is the official hackathon demo path.”

---

## 6. Winning video — shot list (≤ 2:50 spoken, leave cushion)

Judges are **not required** to watch past 3:00. Aim for **2:30–2:50**.

### Gear

- Laptop, landscape screen  
- Quiet room  
- Phone or OBS / Windows Game Bar / QuickTime for screen + voice  
- English narration (you or voiceover)  
- No copyrighted music; no Grok / OpenAI / competitor logos  

### Story arc (why this wins)

1. **Human problem** (10 s) — not “here is my API.”  
2. **Required tech proof** (20 s) — MCP Streamable HTTP on Lambda.  
3. **Wow tools** (60–70 s) — `should_i` + freeze watch.  
4. **Globe / Talk** (25 s) — optional but memorable.  
5. **Architecture + honesty** (20 s) — Alexa+ = LLM, Doc AI = tools, AWS.  
6. **Close** (10 s) — repo + ask.

### Exact spoken script (read this)

**0:00–0:12 — Hook**  
“It’s almost freezing tonight. I need to know if I should leave the hose out — not open five weather apps. That’s Doc AI.”

**0:12–0:32 — Proof it’s real MCP on AWS**  
Show `/health`, then the sim wire / network tab: `initialize`, `tools/list`.  
“Self-hosted MCP, spec 2025-11-25, Streamable HTTP, hosted on AWS Lambda. Eight tools. Alexa+ is the LLM. Doc AI only returns facts and spoken leads.”

**0:32–0:55 — Current weather**  
Ask: “What’s the weather in Rochester?”  
Show the big temperature card + spoken line.  
“Live Open-Meteo and National Weather Service facts.”

**0:55–1:25 — Wow #1: should I**  
Ask: “Should I leave the hose out?”  
Show yes / caution / no with one clear action.  
Optional second: “Should I cover the grill?”

**1:25–1:55 — Wow #2: freeze watch**  
Say: “Watch Rochester for freeze.”  
Click **Confirm freeze watch**.  
Show `watch_conditions` with confirm.  
Then: “Give me a briefing.”  
Point at “Freeze watch is active.”

**1:55–2:15 — Honesty + IoT**  
“IoT sensors here are simulated — labeled that way on purpose.”  
Optional: “List my IoT sensors.”

**2:15–2:35 — Talk to DOC / globe (optional but strong)**  
Cut to whatsupdoc.fyi/doc. Ask about a named place. Globe moves.  
“Same weather brain, conversational front end beside the globe.”

**2:35–2:50 — Close**  
“Repo is Scrum723/doc-ai, MIT. Product feedback and friction log are in the docs. Thanks for watching Doc AI.”

### Editing checklist

- [ ] Under 3:00  
- [ ] English  
- [ ] Public unlisted or public YouTube/Vimeo  
- [ ] MCP wire visible at least once (`tools/list` or `tools/call`)  
- [ ] AWS Lambda mentioned once (Function URL / console flash)  
- [ ] `should_i` and freeze watch both shown  
- [ ] You say Alexa+ is the LLM  
- [ ] No “open this on your Echo at home” claim  
- [ ] Title card: **Doc AI — Alexa+ MCP weather tools**

### Upload

1. YouTube → Unlisted or Public.  
2. Title: `Doc AI — Amazon Developer Hackathon Alexa+ (MCP on AWS Lambda)`  
3. Description: repo URL + live Function URL + one sentence.  
4. Copy the link into Devpost.

---

## 7. Devpost form — fill this in order

1. **Register / Join** on https://amazonappdev2026.devpost.com/  
2. **Enter a Submission**  
3. **Primary track:** Alexa+  
4. **Optional mini:** AWS Builder (Lambda) and/or Open Source if you qualify  
5. **Text description:** paste from `docs/devpost.md` (edit lightly)  
6. **Repo:** https://github.com/Scrum723/doc-ai  
   - Public + MIT license visible, **or** private + add Amazon collaborators when you submit (invites expire in 7 days)  
7. **Demo video** URL  
8. **Product feedback:** paste/adapt `docs/product-feedback.md`  
9. **Friction log:** paste/adapt `docs/friction-log.md` (bonus up to ~10%)  
10. If the project existed before the window: one paragraph on what you added during the submission period  

Amazon collaborator usernames (private repo path):  
`chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`

---

## 8. Day-of recording checklist

- [ ] `/health` returns ok  
- [ ] Sim page loads on the Function URL  
- [ ] One dry-run of hose + freeze watch without recording  
- [ ] Browser zoom 110–125% so cards read on phone playback  
- [ ] Hide bookmarks bar; use a clean profile if you can  
- [ ] Record; watch once at 1.5× — cut anything after 2:50  
- [ ] Upload; paste into Devpost; submit before the deadline  

---

## 9. If something breaks during the video

| Symptom | Fix |
| --- | --- |
| Echo can’t find DOC Weather | Expected — use the web sim, say the FAQ line once |
| Health 403 | Fix Function URL + InvokeFunction permissions |
| Blank sim | Hard refresh; confirm Function URL auth NONE |
| Slow tools | Keep going; say “cold start on Lambda” once |
| Wrong city | Use Rochester / Fairport / Long Pond in the sim catalog |

You are ready when health is green and one freeze-watch dry-run works. The video is the prize path; a home Echo is not.
