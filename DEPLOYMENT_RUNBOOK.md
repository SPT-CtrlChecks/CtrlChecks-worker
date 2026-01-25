# CtrlChecks FastAPI Backend - Production Deployment Runbook

**Version:** 1.0  
**Target OS:** Ubuntu 22.04 LTS  
**Last Updated:** 2024-01-XX

---

## Table of Contents

1. [Pre-Deployment Analysis](#pre-deployment-analysis)
2. [GitHub Repository Setup](#github-repository-setup)
3. [EC2 Instance Setup](#ec2-instance-setup)
4. [Application Deployment](#application-deployment)
5. [Systemd Service Configuration](#systemd-service-configuration)
6. [Nginx Reverse Proxy Setup](#nginx-reverse-proxy-setup)
7. [SSL Certificate with Certbot](#ssl-certificate-with-certbot)
8. [Security Group Configuration](#security-group-configuration)
9. [Verification & Testing](#verification--testing)
10. [Frontend Connection Guide](#frontend-connection-guide)
11. [Rollback Procedure](#rollback-procedure)
12. [Redeploy Procedure](#redeploy-procedure)
13. [Production Checklist](#production-checklist)
14. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Analysis

### Architecture Overview

- **Framework:** FastAPI 0.115.6
- **ASGI Server:** Gunicorn + Uvicorn workers (4 workers)
- **Database:** Supabase (PostgreSQL via Python client)
- **LLM:** Ollama (localhost:11434)
- **Background Jobs:** Async worker pool (2 workers)
- **Authentication:** JWT via Supabase
- **Logging:** JSON structured logging
- **Reverse Proxy:** Nginx
- **Process Manager:** systemd

### Production Readiness Assessment

✅ **Implemented:**
- JWT authentication with Supabase
- Structured JSON logging with request context
- Background task queue with worker pool
- Health endpoints (`/health`, `/health/ollama`)
- CORS middleware configuration
- Environment variable management (pydantic-settings)
- Error handling and retries
- Database connection pooling (Supabase client)
- Gunicorn production server configuration
- systemd service file
- Nginx reverse proxy configuration

⚠️ **Missing/Needs Verification:**
- Database migrations (handled by Supabase, but verify tables exist)
- Rate limiting (not implemented - consider adding)
- Request timeout configuration (120s in gunicorn)
- File upload size limits (50M in Nginx)
- Monitoring/alerting (not included - add CloudWatch/DataDog)
- Backup strategy (not included - Supabase handles DB backups)

---

## Deployment Options

You can deploy in two ways:

### Option 1: Deploy Directly from Local Folder (No Git Required) ⭐ RECOMMENDED FOR QUICK DEPLOYMENT

If you're working directly in the `worker` folder and haven't set up Git yet, you can deploy directly using SCP.

**Skip the Git steps below and go to "EC2 Instance Setup" section.**

### Option 2: Use Git Repository (Recommended for Production)

If you want version control and easier updates:

#### Step 1: Create New Repository

1. Go to GitHub and create a new repository (e.g., `ctrlchecks-worker`)
2. **DO NOT** initialize with README, .gitignore, or license (we have existing code)

#### Step 2: Initialize Git in Worker Directory

```bash
cd worker
git init
git branch -M main
```

#### Step 3: Create .gitignore

```bash
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# Testing
.pytest_cache/
.coverage
htmlcov/

# Distribution
dist/
build/
*.egg-info/
EOF
```

#### Step 4: Commit and Push

```bash
git add .
git commit -m "Initial commit: FastAPI backend for CtrlChecks"
git remote add origin https://github.com/YOUR_USERNAME/ctrlchecks-worker.git
git push -u origin main
```

**Note:** Replace `YOUR_USERNAME` with your GitHub username.

---

## EC2 Instance Setup

### Step 1: Launch EC2 Instance

1. **AMI:** Ubuntu 22.04 LTS (amd64)
2. **Instance Type:** t3.medium or larger (2 vCPU, 4GB RAM minimum)
3. **Storage:** 20GB gp3 SSD minimum
4. **Security Group:** Create new (we'll configure ports later)
5. **Key Pair:** Use existing or create new SSH key pair

### Step 2: Connect to Instance

```bash
# Correct syntax: ssh -i <key-file> <user>@<ip-address>
ssh -i worker-key.pem ubuntu@13.233.160.76

# If key file is in different location:
ssh -i /path/to/worker-key.pem ubuntu@13.233.160.76

# On Windows PowerShell, you may need to specify the full path:
ssh -i C:\Users\User\Desktop\ctrlchecks-ai-workflow-os\worker\worker-key.pem ubuntu@13.233.160.76
```

### Step 3: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx
```

**Note:** The system may have Python 3.11 or 3.12 instead of 3.10. Check available version:
```bash
python3 --version
# Should show: Python 3.11.x or Python 3.12.x
```

### Step 4: Create Application Directory

```bash
sudo mkdir -p /opt/ctrlchecks
sudo chown ubuntu:ubuntu /opt/ctrlchecks
```

### Step 5: Deploy Application Files

**Option A: Deploy from Local Folder (No Git Required)**

If you're working directly in the `worker` folder locally and haven't pushed to Git:

```bash
# On your LOCAL machine (Windows PowerShell or WSL)
# From the project root directory
scp -i worker-key.pem -r worker ubuntu@13.233.160.76:/opt/ctrlchecks/

# Then SSH into the server
ssh -i worker-key.pem ubuntu@13.233.160.76

# On the server, verify files are there
cd /opt/ctrlchecks/worker
ls -la
```

**Option B: Clone from Git Repository**

If you've pushed to GitHub:

**Option A: Deploy from Local Folder (No Git Required)** ⭐ Use this if you haven't pushed to Git

From your **LOCAL machine** (Windows PowerShell), copy the `worker` folder to EC2:

```powershell
# From your project root directory (where worker folder is)
# Make sure you're in: C:\Users\User\Desktop\ctrlchecks-ai-workflow-os

# Copy the entire worker folder to EC2
scp -i worker-key.pem -r worker ubuntu@13.233.160.76:/opt/ctrlchecks/

# If worker-key.pem is in a different location, use full path:
# scp -i C:\path\to\worker-key.pem -r worker ubuntu@13.233.160.76:/opt/ctrlchecks/
```

**Then SSH into the server to verify:**

```bash
ssh -i worker-key.pem ubuntu@13.233.160.76

# On the server, verify files are there
cd /opt/ctrlchecks/worker
ls -la
# You should see: app/, data/, requirements.txt, etc.
```

**Option B: Clone from Git Repository**

If you've pushed to GitHub:

```bash
cd /opt/ctrlchecks
git clone https://github.com/YOUR_USERNAME/ctrlchecks-worker.git worker
cd worker
```

**Note:** Replace `YOUR_USERNAME` with your GitHub username.

---

## Application Deployment

### Step 1: Create Python Virtual Environment

```bash
cd /opt/ctrlchecks

# Check Python version first
python3 --version
# Should show: Python 3.11.x or Python 3.12.x

# Create virtual environment (use python3, not python3.10)
python3 -m venv venv
source venv/bin/activate

# Verify Python version in venv
python --version
```

### Step 2: Install Dependencies

```bash
cd /opt/ctrlchecks/worker
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected output:** All packages install successfully, no errors.

### Step 3: Verify Installation

```bash
python3 -c "import fastapi; print(f'FastAPI {fastapi.__version__}')"
python3 -c "import supabase; print('Supabase client OK')"
python3 -c "import gunicorn; print('Gunicorn OK')"
```

### Step 4: Create Environment File

```bash
cd /opt/ctrlchecks
cp worker/env.example .env
sudo chmod 600 .env
```

### Step 5: Configure Environment Variables

```bash
sudo nano /opt/ctrlchecks/.env
```

**Fill in all required values:**

```env
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_JWT_PUBLIC_KEY=your-jwt-public-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT_SECONDS=60

# API Keys (Optional - only if using these providers)
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CHATBOT_API_KEY=

# Webhook Security
WEBHOOK_SECRET=your-random-secret-here

# Public Base URL (REQUIRED - your domain)
PUBLIC_BASE_URL=https://api.yourdomain.com

# Worker Configuration
WORKER_ID=worker-prod-1
LOG_LEVEL=INFO
PROCESS_TIMEOUT_SECONDS=1800
MAX_RETRIES=3
RETRY_BASE_SECONDS=1.0
RETRY_MAX_SECONDS=20.0

# CORS (comma-separated origins or * for all)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Critical Notes:**
- `PUBLIC_BASE_URL` must be your actual domain (e.g., `https://api.ctrlchecks.ai`)
- `ALLOWED_ORIGINS` should list your frontend domains (comma-separated, no spaces)
- Get Supabase keys from: Supabase Dashboard → Project Settings → API
- Generate `WEBHOOK_SECRET` with: `openssl rand -hex 32`

### Step 6: Verify Environment Loading

```bash
source /opt/ctrlchecks/venv/bin/activate
cd /opt/ctrlchecks/worker
python3 << 'EOF'
from app.settings import settings
print(f"Supabase URL: {settings.supabase_url}")
print(f"Public Base URL: {settings.public_base_url}")
print(f"Ollama URL: {settings.ollama_base_url}")
print("Environment loaded successfully!")
EOF
```

**Expected output:** All values print correctly, no errors.

### Step 7: Verify Data Files Exist

```bash
ls -la /opt/ctrlchecks/worker/data/
```

**Required files:**
- `node_reference.json`
- `node_reference_full.md`
- `prompt_templates.json`
- `agent_personas.json`
- `workflow_templates.json`
- `webhook_configs.json`
- `form_templates.json`

If any are missing, ensure they're committed to the repository.

### Step 8: Test Database Connection

```bash
source /opt/ctrlchecks/venv/bin/activate
cd /opt/ctrlchecks/worker
python3 << 'EOF'
from app.database import get_supabase_client
client = get_supabase_client()
result = client.table('workflows').select('id').limit(1).execute()
print(f"✅ Database connection successful! Found {len(result.data)} workflows")
EOF
```

**Expected output:** Connection successful message.

---

## Systemd Service Configuration

### Step 1: Copy Service File

```bash
sudo cp /opt/ctrlchecks/worker/systemd/ctrlchecks.service /etc/systemd/system/
```

### Step 2: Verify Service File

```bash
sudo cat /etc/systemd/system/ctrlchecks.service
```

**Expected content:**
```
[Unit]
Description=CtrlChecks FastAPI Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/ctrlchecks/worker
Environment="PATH=/opt/ctrlchecks/venv/bin"
EnvironmentFile=/opt/ctrlchecks/.env
ExecStart=/opt/ctrlchecks/venv/bin/gunicorn app.main:app -c gunicorn.conf.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 3: Reload systemd and Enable Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable ctrlchecks
```

### Step 4: Start Service

```bash
sudo systemctl start ctrlchecks
```

### Step 5: Check Status

```bash
sudo systemctl status ctrlchecks
```

**Expected output:** `Active: active (running)`

### Step 6: Verify Logs

```bash
sudo journalctl -u ctrlchecks -n 50 --no-pager
```

**Look for:**
- `Worker pool started`
- No error messages
- Application listening on port 8000

### Step 7: Test Local Endpoint

```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{"status":"ok"}
```

---

## Nginx Reverse Proxy Setup

### Step 1: Copy Nginx Configuration

```bash
sudo cp /opt/ctrlchecks/worker/nginx/ctrlchecks.conf /etc/nginx/sites-available/ctrlchecks
```

### Step 2: Update Server Name

```bash
sudo nano /etc/nginx/sites-available/ctrlchecks
```

**Change:**
```
server_name api.yourdomain.com;
```

**To your actual domain:**
```
server_name api.ctrlchecks.ai;
```

### Step 3: Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/ctrlchecks /etc/nginx/sites-enabled/
```

### Step 4: Remove Default Site (Optional)

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Step 5: Test Nginx Configuration

```bash
sudo nginx -t
```

**Expected output:** `syntax is ok` and `test is successful`

### Step 6: Start/Reload Nginx

```bash
sudo systemctl start nginx
sudo systemctl reload nginx
```

### Step 7: Verify Nginx Status

```bash
sudo systemctl status nginx
```

**Expected output:** `Active: active (running)`

### Step 8: Test HTTP Endpoint

```bash
curl http://api.yourdomain.com/health
```

**Expected response:**
```json
{"status":"ok"}
```

**Note:** Replace `api.yourdomain.com` with your actual domain.

---

## SSL Certificate with Certbot

### Step 1: Install Certbot (if not already installed)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Obtain SSL Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
```

**Follow prompts:**
1. Enter email address
2. Agree to terms of service
3. Choose whether to redirect HTTP to HTTPS (recommended: Yes)

**Expected output:** Certificate obtained and Nginx automatically configured.

### Step 3: Verify Certificate

```bash
sudo certbot certificates
```

**Expected output:** Certificate listed with expiration date.

### Step 4: Test HTTPS Endpoint

```bash
curl https://api.yourdomain.com/health
```

**Expected response:**
```json
{"status":"ok"}
```

### Step 5: Verify Auto-Renewal

```bash
sudo systemctl status certbot.timer
```

**Expected output:** Timer is active and enabled.

### Step 6: Test Renewal (Dry Run)

```bash
sudo certbot renew --dry-run
```

**Expected output:** Renewal simulation successful.

---

## Security Group Configuration

### Step 1: Configure AWS Security Group

In AWS Console → EC2 → Security Groups:

**Inbound Rules:**
- **Type:** HTTP, **Port:** 80, **Source:** 0.0.0.0/0
- **Type:** HTTPS, **Port:** 443, **Source:** 0.0.0.0/0
- **Type:** SSH, **Port:** 22, **Source:** Your IP only (for security)

**Outbound Rules:**
- **Type:** All traffic, **Port:** All, **Destination:** 0.0.0.0/0

### Step 2: Verify Ports Are Open

```bash
# From your local machine
curl http://YOUR_EC2_IP/health
```

**Note:** This will only work after Nginx is configured and running.

---

## Verification & Testing

### Step 1: Health Endpoint

```bash
curl https://api.yourdomain.com/health
```

**Expected:**
```json
{"status":"ok"}
```

### Step 2: Ollama Health Endpoint

```bash
curl https://api.yourdomain.com/health/ollama
```

**Expected:** JSON response with Ollama status (may show error if Ollama not running locally).

### Step 3: Check Service Logs

```bash
sudo journalctl -u ctrlchecks -f
```

**In another terminal, make a request:**
```bash
curl https://api.yourdomain.com/health
```

**Expected in logs:** Request logged with JSON structure.

### Step 4: Test Authentication Endpoint

```bash
# Get a JWT token from your frontend or Supabase
TOKEN="your-jwt-token-here"

curl -X POST https://api.yourdomain.com/generate-workflow \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test workflow","mode":"analyze"}'
```

**Expected:** JSON response (may be error if workflow generation fails, but auth should work).

### Step 5: Check Nginx Access Logs

```bash
sudo tail -f /var/log/nginx/access.log
```

**Make a request and verify it's logged.**

### Step 6: Check Error Logs

```bash
sudo journalctl -u ctrlchecks -p err -n 20
sudo tail -20 /var/log/nginx/error.log
```

**Expected:** No errors (or only expected warnings).

### Step 7: Load Test (Optional)

```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Run 100 requests, 10 concurrent
ab -n 100 -c 10 https://api.yourdomain.com/health
```

**Expected:** All requests succeed (200 status).

---

## Frontend Connection Guide

### Step 1: Update Frontend Environment Variables

In your frontend `.env` file (or build-time environment variables):

```env
VITE_PYTHON_BACKEND_URL=https://api.yourdomain.com
VITE_PUBLIC_BASE_URL=https://api.yourdomain.com
```

**Critical:** Replace `api.yourdomain.com` with your actual domain.

### Step 2: Verify Frontend Configuration

Check `src/config/endpoints.ts`:

```typescript
export const ENDPOINTS = {
    itemBackend: ensureProtocol(getEnvVar('VITE_PYTHON_BACKEND_URL', 'http://localhost:8000')),
    // ...
};
```

This should now point to your production API.

### Step 3: CORS Configuration

Verify `worker/app/main.py` has correct CORS settings:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origins],  # Should be your frontend domain(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**In `.env` on server:**
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Step 4: Frontend API Endpoints

The frontend should call these endpoints (all under `VITE_PYTHON_BACKEND_URL`):

- `POST /generate-workflow` - Generate workflow
- `GET /workflow-status/{job_id}` - Check workflow generation status
- `POST /execute-workflow` - Execute workflow
- `POST /chat-api` - Chat API
- `POST /execute-multimodal-agent` - Multimodal agent execution
- `GET /health` - Health check
- `POST /webhook-trigger/{workflow_id}` - Webhook trigger
- `GET /form-trigger/{workflow_id}/{node_id}` - Form trigger
- `POST /form-trigger/{workflow_id}/{node_id}/submit` - Form submission

**All endpoints require `Authorization: Bearer <JWT_TOKEN>` header** (except health and public webhooks).

### Step 5: Test Frontend Connection

1. Build and deploy frontend
2. Open browser DevTools → Network tab
3. Make a request (e.g., generate workflow)
4. Verify request goes to `https://api.yourdomain.com/...`
5. Verify response is successful

---

## Rollback Procedure

### Scenario 1: Rollback to Previous Code Version

```bash
# 1. Stop service
sudo systemctl stop ctrlchecks

# 2. Navigate to application
cd /opt/ctrlchecks/worker

# 3. Check git log for previous commit
git log --oneline -10

# 4. Checkout previous commit
git checkout <previous-commit-hash>

# 5. Restart service
sudo systemctl start ctrlchecks

# 6. Verify
sudo systemctl status ctrlchecks
curl https://api.yourdomain.com/health
```

### Scenario 2: Rollback Environment Variables

```bash
# 1. Edit environment file
sudo nano /opt/ctrlchecks/.env

# 2. Revert changes manually

# 3. Restart service
sudo systemctl restart ctrlchecks

# 4. Verify
sudo systemctl status ctrlchecks
```

### Scenario 3: Complete Rollback (Emergency)

```bash
# 1. Stop everything
sudo systemctl stop ctrlchecks
sudo systemctl stop nginx

# 2. Restore from backup (if you have one)
# Or revert to known good commit
cd /opt/ctrlchecks/worker
git checkout <known-good-commit>

# 3. Restart
sudo systemctl start ctrlchecks
sudo systemctl start nginx

# 4. Verify
sudo systemctl status ctrlchecks
curl https://api.yourdomain.com/health
```

---

## Redeploy Procedure

### Step 1: Pull Latest Code

```bash
cd /opt/ctrlchecks/worker
git pull origin main
```

### Step 2: Update Dependencies (if requirements.txt changed)

```bash
source /opt/ctrlchecks/venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Verify Environment Variables (if .env.example changed)

```bash
# Compare with example
diff /opt/ctrlchecks/.env /opt/ctrlchecks/worker/env.example
```

**Add any new required variables to `.env`.**

### Step 4: Restart Service

```bash
sudo systemctl restart ctrlchecks
```

### Step 5: Verify Deployment

```bash
# Check status
sudo systemctl status ctrlchecks

# Check logs
sudo journalctl -u ctrlchecks -n 50

# Test endpoint
curl https://api.yourdomain.com/health
```

### Step 6: Monitor for Errors

```bash
# Watch logs for 1 minute
sudo journalctl -u ctrlchecks -f
```

**Press Ctrl+C after verifying no errors.**

---

## Production Checklist

### Pre-Deployment

- [ ] GitHub repository created and code pushed
- [ ] EC2 instance launched (Ubuntu 22.04, t3.medium+)
- [ ] Security group configured (HTTP, HTTPS, SSH)
- [ ] Domain DNS A record points to EC2 IP
- [ ] Supabase project created and service role key obtained
- [ ] JWT public key and secret obtained from Supabase
- [ ] All environment variables documented and ready

### Deployment

- [ ] System packages installed (Python, Nginx, Certbot)
- [ ] Application directory created (`/opt/ctrlchecks`)
- [ ] Repository cloned
- [ ] Python virtual environment created
- [ ] Dependencies installed
- [ ] Environment file created and configured
- [ ] Environment variables verified (test import)
- [ ] Database connection tested
- [ ] Data files verified (all JSON files present)
- [ ] systemd service file installed
- [ ] Service enabled and started
- [ ] Service status verified (active/running)
- [ ] Local health endpoint tested (`curl localhost:8000/health`)
- [ ] Nginx configuration installed
- [ ] Nginx server_name updated
- [ ] Nginx site enabled
- [ ] Nginx configuration tested (`nginx -t`)
- [ ] Nginx started/reloaded
- [ ] HTTP endpoint tested (`curl http://api.yourdomain.com/health`)
- [ ] SSL certificate obtained (Certbot)
- [ ] HTTPS endpoint tested (`curl https://api.yourdomain.com/health`)
- [ ] Auto-renewal verified (`certbot renew --dry-run`)

### Post-Deployment

- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Ollama health endpoint accessible
- [ ] Service logs show no errors
- [ ] Nginx access logs working
- [ ] Authentication endpoint tested (with JWT token)
- [ ] CORS configured correctly
- [ ] Frontend environment variables updated
- [ ] Frontend can connect to API
- [ ] Frontend API calls succeed
- [ ] Webhook endpoints accessible
- [ ] Form trigger endpoints accessible
- [ ] Load test passed (optional)
- [ ] Monitoring/alerting configured (if applicable)

### Security

- [ ] `.env` file permissions set to 600
- [ ] Service runs as non-root user (ubuntu)
- [ ] SSH access restricted to your IP
- [ ] Firewall rules configured (security group)
- [ ] SSL certificate valid and auto-renewal enabled
- [ ] CORS origins restricted (not `*` in production)
- [ ] Webhook secret configured
- [ ] Service role key kept secure (not in logs)

### Maintenance

- [ ] Backup strategy documented
- [ ] Rollback procedure tested
- [ ] Redeploy procedure documented
- [ ] Log rotation configured (systemd handles this)
- [ ] Monitoring dashboard (if applicable)
- [ ] Alerting rules configured (if applicable)

---

## Troubleshooting

### Service Won't Start

```bash
# Check status
sudo systemctl status ctrlchecks

# Check logs
sudo journalctl -u ctrlchecks -n 100

# Common issues:
# 1. Missing environment variables
# 2. Python import errors
# 3. Port 8000 already in use
# 4. Permission issues
```

**Solutions:**
- Verify `.env` file exists and has all required variables
- Test Python imports: `python3 -c "from app.main import app"`
- Check port: `sudo lsof -i :8000`
- Verify permissions: `ls -la /opt/ctrlchecks/`

### 502 Bad Gateway

```bash
# Check if service is running
sudo systemctl status ctrlchecks

# Check if service is listening
curl http://localhost:8000/health

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

**Solutions:**
- Start service: `sudo systemctl start ctrlchecks`
- Check service logs: `sudo journalctl -u ctrlchecks -n 50`
- Verify Gunicorn is running: `ps aux | grep gunicorn`

### Database Connection Errors

```bash
# Test connection manually
source /opt/ctrlchecks/venv/bin/activate
cd /opt/ctrlchecks/worker
python3 << 'EOF'
from app.database import get_supabase_client
client = get_supabase_client()
result = client.table('workflows').select('id').limit(1).execute()
print(result)
EOF
```

**Solutions:**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check Supabase project is active
- Verify network connectivity: `curl https://your-project.supabase.co`

### CORS Errors

```bash
# Check CORS configuration
grep -r "allowed_origins" /opt/ctrlchecks/worker/app/

# Check environment variable
grep ALLOWED_ORIGINS /opt/ctrlchecks/.env
```

**Solutions:**
- Update `ALLOWED_ORIGINS` in `.env` to include frontend domain
- Restart service: `sudo systemctl restart ctrlchecks`
- Verify frontend is calling correct domain

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Check Nginx SSL configuration
sudo nginx -t
```

**Solutions:**
- Renew certificate: `sudo certbot renew`
- Verify DNS A record points to EC2 IP
- Check security group allows HTTPS (port 443)

### High Memory Usage

```bash
# Check memory
free -h

# Check process memory
ps aux | grep gunicorn

# Check systemd limits
systemctl show ctrlchecks | grep Memory
```

**Solutions:**
- Reduce Gunicorn workers in `gunicorn.conf.py`
- Upgrade instance type
- Check for memory leaks in logs

---

## Additional Resources

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Gunicorn Docs:** https://docs.gunicorn.org/
- **Nginx Docs:** https://nginx.org/en/docs/
- **Certbot Docs:** https://certbot.eff.org/
- **systemd Docs:** https://www.freedesktop.org/software/systemd/man/systemd.service.html

---

**End of Deployment Runbook**
