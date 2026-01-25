# CtrlChecks FastAPI Backend

This service runs a single FastAPI backend on EC2.

## Architecture
- FastAPI is the only runtime for API endpoints and workflows.
- Supabase is used only for JWT verification and database access (service role).
- Long-running AI/workflow generation uses background tasks and `workflow_generation_jobs`.
- All responses match frontend expectations (paths, payloads, status codes).

## Environment Variables
Copy `env.example` to `.env` on the server and fill values:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_PUBLIC_KEY=
SUPABASE_JWT_SECRET=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT_SECONDS=60
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CHATBOT_API_KEY=
PUBLIC_BASE_URL=
WORKER_ID=worker-local
LOG_LEVEL=INFO
PROCESS_TIMEOUT_SECONDS=1800
MAX_RETRIES=3
RETRY_BASE_SECONDS=1.0
RETRY_MAX_SECONDS=20.0
ALLOWED_ORIGINS=*
```

## Local Run
```bash
cd worker
python -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Deployment (systemd)
Use `deploy/workflow-worker.service` and point `EnvironmentFile` to `/opt/worker/.env`.

## Nginx Reverse Proxy Example
```nginx
server {
  listen 80;
  server_name api.ctrlchecks.ai;

  location / {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Health Endpoints
- `GET /health`
- `GET /health/ollama`

## Curl Examples
```bash
curl -X POST https://api.ctrlchecks.ai/generate-workflow \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Build a simple chatbot"}'

curl https://api.ctrlchecks.ai/workflow-status/job_123

curl -X POST https://api.ctrlchecks.ai/chat-api \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"wf_123","message":"hello"}'

curl -X POST https://api.ctrlchecks.ai/webhook-trigger/wf_123 \
  -H "Content-Type: application/json" \
  -d '{"event":"created"}'
```

## Migration Checklist
- Remove Supabase function deploy steps.
- Update frontend to use the FastAPI endpoints directly (no legacy edge paths).
- Remove any Deno runtime dependencies from infra.
- Verify `workflow_generation_jobs` table exists and is writable.
- Rotate Supabase service role key after cutover.
