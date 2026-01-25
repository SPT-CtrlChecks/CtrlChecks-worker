# Production Readiness Checklist

Complete checklist to verify your FastAPI backend is ready for production deployment.

---

## Architecture & Code

### Code Quality
- [ ] All Python code follows PEP 8 style guide
- [ ] No hardcoded secrets or API keys in code
- [ ] All environment variables loaded from `.env` file
- [ ] Error handling implemented for all external calls
- [ ] Logging implemented for critical operations
- [ ] Type hints used throughout codebase
- [ ] No debug/print statements in production code
- [ ] All TODO/FIXME comments addressed or documented

### Dependencies
- [ ] `requirements.txt` is up to date
- [ ] All dependencies pinned to specific versions
- [ ] No security vulnerabilities in dependencies (`pip audit` or `safety check`)
- [ ] Gunicorn configured for production (4+ workers)
- [ ] All required Python packages listed in `requirements.txt`

### Data Files
- [ ] `worker/data/node_reference.json` exists and is valid JSON
- [ ] `worker/data/node_reference_full.md` exists
- [ ] `worker/data/prompt_templates.json` exists and is valid JSON
- [ ] `worker/data/agent_personas.json` exists and is valid JSON
- [ ] `worker/data/workflow_templates.json` exists and is valid JSON
- [ ] `worker/data/webhook_configs.json` exists and is valid JSON
- [ ] `worker/data/form_templates.json` exists and is valid JSON
- [ ] All data files committed to repository

---

## Configuration

### Environment Variables
- [ ] `SUPABASE_URL` set and correct
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set and correct
- [ ] `SUPABASE_JWT_PUBLIC_KEY` set (or `SUPABASE_JWT_SECRET` for HS256)
- [ ] `PUBLIC_BASE_URL` set to production domain (e.g., `https://api.yourdomain.com`)
- [ ] `OLLAMA_BASE_URL` set to `http://localhost:11434`
- [ ] `ALLOWED_ORIGINS` set to frontend domain(s) (not `*` in production)
- [ ] `LOG_LEVEL` set to `INFO` or `WARNING` (not `DEBUG`)
- [ ] `WORKER_ID` set to unique identifier
- [ ] Optional API keys set if using those providers
- [ ] `WEBHOOK_SECRET` set to random secure value
- [ ] `.env` file permissions set to `600` (readable only by owner)

### Service Configuration
- [ ] systemd service file installed at `/etc/systemd/system/ctrlchecks.service`
- [ ] Service user is non-root (`ubuntu`)
- [ ] Working directory set to `/opt/ctrlchecks/worker`
- [ ] Environment file path correct (`/opt/ctrlchecks/.env`)
- [ ] Gunicorn command correct (`gunicorn app.main:app -c gunicorn.conf.py`)
- [ ] Restart policy set to `always`
- [ ] Service enabled for auto-start on boot

### Gunicorn Configuration
- [ ] `gunicorn.conf.py` exists and configured
- [ ] Worker count appropriate (4 workers for t3.medium)
- [ ] Worker class set to `uvicorn.workers.UvicornWorker`
- [ ] Bind address set to `0.0.0.0:8000`
- [ ] Timeout set appropriately (120 seconds)
- [ ] Logging configured (accesslog, errorlog, loglevel)

---

## Infrastructure

### EC2 Instance
- [ ] Instance type appropriate (t3.medium or larger)
- [ ] Sufficient storage (20GB+)
- [ ] Ubuntu 22.04 LTS installed
- [ ] System packages updated (`apt update && apt upgrade`)
- [ ] Python 3.10+ installed
- [ ] Git installed
- [ ] Nginx installed
- [ ] Certbot installed

### Network
- [ ] Security group configured
- [ ] Port 80 (HTTP) open to `0.0.0.0/0`
- [ ] Port 443 (HTTPS) open to `0.0.0.0/0`
- [ ] Port 22 (SSH) restricted to your IP only
- [ ] DNS A record points to EC2 IP address
- [ ] Domain resolves correctly (`dig api.yourdomain.com`)

### Nginx
- [ ] Nginx configuration file installed
- [ ] `server_name` set to production domain
- [ ] `proxy_pass` points to `http://127.0.0.1:8000`
- [ ] Proxy headers configured correctly
- [ ] `client_max_body_size` set appropriately (50M)
- [ ] Configuration tested (`nginx -t`)
- [ ] Site enabled (`ln -s` to sites-enabled)
- [ ] Default site removed (if applicable)
- [ ] Nginx running and enabled

### SSL/TLS
- [ ] SSL certificate obtained via Certbot
- [ ] Certificate valid (not expired)
- [ ] Auto-renewal configured (`certbot.timer` active)
- [ ] Renewal tested (`certbot renew --dry-run`)
- [ ] HTTPS redirect configured (HTTP → HTTPS)
- [ ] Certificate covers correct domain

---

## Database

### Supabase Connection
- [ ] Supabase project active and accessible
- [ ] Service role key valid and has correct permissions
- [ ] Database connection test successful
- [ ] JWT public key or secret configured correctly
- [ ] Can query `workflows` table
- [ ] Can query `executions` table
- [ ] Can query `workflow_generation_jobs` table
- [ ] Can query `profiles` table
- [ ] Can query `user_roles` table

### Database Schema
- [ ] All required tables exist
- [ ] All required columns exist
- [ ] Foreign key constraints correct
- [ ] Indexes created for performance
- [ ] Row Level Security (RLS) policies configured (if applicable)

---

## Application

### Service Status
- [ ] Service is running (`systemctl status ctrlchecks`)
- [ ] Service auto-starts on boot (`systemctl is-enabled ctrlchecks`)
- [ ] No errors in service logs (`journalctl -u ctrlchecks`)
- [ ] Gunicorn workers running (`ps aux | grep gunicorn`)
- [ ] Application listening on port 8000 (`curl http://localhost:8000/health`)

### Health Endpoints
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] `GET /health/ollama` returns Ollama status
- [ ] Health endpoints respond quickly (< 100ms)
- [ ] Health endpoints accessible via HTTPS

### Authentication
- [ ] JWT token validation working
- [ ] Can extract user from token
- [ ] User profile loading works
- [ ] User roles loading works
- [ ] Unauthorized requests return 401
- [ ] Invalid tokens rejected

### API Endpoints
- [ ] `POST /generate-workflow` works with valid token
- [ ] `GET /workflow-status/{job_id}` works
- [ ] `POST /execute-workflow` works
- [ ] `POST /chat-api` works
- [ ] `POST /execute-multimodal-agent` works
- [ ] `POST /webhook-trigger/{workflow_id}` works
- [ ] `GET /form-trigger/{workflow_id}/{node_id}` works
- [ ] `POST /form-trigger/{workflow_id}/{node_id}/submit` works
- [ ] All endpoints return proper HTTP status codes
- [ ] All endpoints return JSON responses

### Background Jobs
- [ ] Worker pool starts successfully
- [ ] Background tasks can be enqueued
- [ ] Background tasks execute successfully
- [ ] Worker pool stops gracefully on shutdown

### Error Handling
- [ ] Invalid requests return 400 with error message
- [ ] Unauthorized requests return 401
- [ ] Forbidden requests return 403
- [ ] Not found returns 404
- [ ] Server errors return 500
- [ ] Error responses include helpful messages
- [ ] Errors logged to journalctl

---

## Logging & Monitoring

### Logging
- [ ] Logging configured (JSON format)
- [ ] Log level set appropriately (INFO/WARNING)
- [ ] Request IDs included in logs
- [ ] User IDs included in logs (when available)
- [ ] Errors logged with stack traces
- [ ] Logs accessible via `journalctl -u ctrlchecks`
- [ ] Log rotation configured (systemd handles this)

### Monitoring (Optional but Recommended)
- [ ] CloudWatch/DataDog agent installed (if using)
- [ ] Metrics collection configured
- [ ] Alerts configured for:
  - [ ] Service down
  - [ ] High error rate
  - [ ] High response time
  - [ ] High memory usage
  - [ ] High CPU usage

---

## Security

### Access Control
- [ ] Service runs as non-root user
- [ ] `.env` file permissions restricted (600)
- [ ] SSH access restricted to specific IPs
- [ ] Firewall rules configured (security group)
- [ ] No unnecessary ports open

### Authentication & Authorization
- [ ] JWT tokens validated on all protected endpoints
- [ ] Service role key protected (not in logs)
- [ ] Admin endpoints require admin role
- [ ] User context properly extracted from tokens
- [ ] CORS origins restricted (not `*`)

### Data Protection
- [ ] Sensitive data not logged
- [ ] API keys stored securely (environment variables)
- [ ] Database credentials not exposed
- [ ] Webhook secret configured and used

### SSL/TLS
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid and not expired
- [ ] Auto-renewal configured
- [ ] Strong cipher suites configured (Nginx default)

---

## Performance

### Response Times
- [ ] Health endpoint < 100ms
- [ ] Simple API calls < 500ms
- [ ] Complex operations < 5s (or async with job queue)
- [ ] No timeout errors under normal load

### Resource Usage
- [ ] Memory usage reasonable (< 2GB for t3.medium)
- [ ] CPU usage reasonable (< 50% average)
- [ ] Disk I/O reasonable
- [ ] Network bandwidth sufficient

### Scalability
- [ ] Worker count appropriate for instance size
- [ ] Background job queue can handle load
- [ ] Database connection pooling configured
- [ ] Can handle concurrent requests

---

## Frontend Integration

### Configuration
- [ ] Frontend `VITE_PYTHON_BACKEND_URL` set correctly
- [ ] Frontend can reach backend (no CORS errors)
- [ ] Frontend authentication working
- [ ] Frontend API calls succeed

### End-to-End Testing
- [ ] Workflow generation works from frontend
- [ ] Workflow execution works from frontend
- [ ] Chat API works from frontend
- [ ] Form triggers work from frontend
- [ ] Webhooks work from frontend
- [ ] Error messages display correctly in frontend

---

## Backup & Recovery

### Backup Strategy
- [ ] Database backups configured (Supabase handles this)
- [ ] Application code in version control (Git)
- [ ] Environment variables documented
- [ ] Rollback procedure documented and tested

### Recovery Testing
- [ ] Can restore from previous code version
- [ ] Can restore environment variables
- [ ] Service can restart after failure
- [ ] Data integrity maintained

---

## Documentation

### Deployment
- [ ] Deployment runbook created and reviewed
- [ ] Frontend wiring guide created
- [ ] Production checklist created (this document)
- [ ] Troubleshooting guide created

### Operations
- [ ] Service management commands documented
- [ ] Log access procedures documented
- [ ] Environment variable reference documented
- [ ] API endpoint reference documented

---

## Final Verification

### Smoke Tests
- [ ] Service starts successfully
- [ ] Health endpoint accessible
- [ ] Authenticated endpoint works
- [ ] Database queries work
- [ ] Background jobs work
- [ ] Logs show no errors

### Load Test (Optional)
- [ ] Can handle 100 concurrent requests
- [ ] Response times acceptable under load
- [ ] No memory leaks
- [ ] No connection errors

### Security Scan (Optional)
- [ ] No known vulnerabilities in dependencies
- [ ] No exposed secrets
- [ ] SSL configuration secure
- [ ] CORS properly configured

---

## Go-Live Checklist

Before going live, verify:

- [ ] All items above checked
- [ ] DNS propagation complete
- [ ] SSL certificate valid
- [ ] Frontend deployed and connected
- [ ] Monitoring/alerting active
- [ ] Team notified of deployment
- [ ] Rollback plan ready
- [ ] On-call engineer available

---

## Post-Deployment

### Immediate (First Hour)
- [ ] Monitor service logs for errors
- [ ] Monitor health endpoint
- [ ] Monitor frontend for user reports
- [ ] Verify all critical workflows work

### First 24 Hours
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor resource usage
- [ ] Address any issues promptly

### First Week
- [ ] Review logs for patterns
- [ ] Optimize based on usage
- [ ] Update documentation based on learnings
- [ ] Plan improvements

---

**Last Updated:** 2024-01-XX  
**Version:** 1.0
