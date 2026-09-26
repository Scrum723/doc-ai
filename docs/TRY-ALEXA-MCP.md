# Try the Alexa MCP (Doc AI) with AWS $150 credits

Local MCP is already the real Alexa+ skill surface: Streamable HTTP, spec 2025-11-25, six tools.

## 1. Try it on this machine (now)

Server: http://127.0.0.1:8790/

```powershell
cd C:\Users\cclot\doc-ai
npm run dev
```

- Chat UI: http://127.0.0.1:8790/
- Health: http://127.0.0.1:8790/health
- MCP: `POST http://127.0.0.1:8790/mcp`

Smoke:

```powershell
cd C:\Users\cclot\doc-ai
node deploy/mcp-smoke.mjs
```

Ask in the UI: **What's the weather in Rochester?**

## 2. Put it on AWS (spend the credits)

No Docker required. App Runner can build from GitHub.

1. AWS console → **App Runner** → Create service  
   Region: `us-east-1` (or `us-east-2` if that is where the credits sit)
2. Source: **Source code repository** → connect GitHub → `Scrum723/doc-ai` → branch `main`
3. Runtime **Node.js 22**
   - Build: `npm install`
   - Start: `npm run start`
   - Port: `8790`
4. Env:
   - `HOST=0.0.0.0`
   - `PORT=8790`
   - `ALLOWED_ORIGINS=https://whatsupdoc.fyi,https://www.whatsupdoc.fyi`
5. CPU 1 vCPU / 2 GB is enough. Credits cover this easily.
6. After deploy, open `https://<id>.awsapprunner.com/health` then `/` for the Alexa sim.

CLI after `aws login` (or `aws configure`):

```powershell
cd C:\Users\cclot\doc-ai
# still needs a GitHub connection ARN from the App Runner console first
# then:
aws apprunner list-connections --region us-east-1
```

## 3. Point WhatsUpDoc Talk to DOC at it

On Railway for `api.whatsupdoc.fyi`:

```
DOC_AI_MCP_URL=https://<id>.awsapprunner.com
```

Then Talk to DOC can pull Doc AI MCP briefings into the neural layer.

## 4. Alexa+ Developer console (optional)

When the App Runner URL is live, register that Streamable HTTP endpoint as the self-hosted MCP skill URL (`/mcp`).
