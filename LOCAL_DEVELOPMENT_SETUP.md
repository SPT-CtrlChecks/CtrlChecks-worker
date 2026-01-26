# 🚀 Local Development Setup Guide

**Node.js Backend - Complete Local Setup**

This guide shows you how to set up and run the Node.js backend locally.

---

## 📋 Prerequisites

Before starting, make sure you have:

1. **Node.js 18+** installed
2. **npm** or **yarn** package manager
3. **Ollama** installed and running locally (for AI features)
4. **Supabase** account (or local Supabase instance)
5. **FastAPI Ollama Service** (optional, for multimodal AI)

---

## 🏗️ Architecture Overview

When running locally, you need these services:

```
┌─────────────┐
│  Frontend   │  (React/Vite)
│  Port: 5173 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Worker    │  (Node.js/Express - this service)
│  Port: 3001 │
└──────┬──────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌─────────────┐    ┌──────────────────┐
│  Supabase   │    │ FastAPI Ollama   │  (Optional - for multimodal AI)
│  (Cloud)    │    │   Port: 8000     │
└─────────────┘    └──────┬───────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │   Ollama    │  (Local AI)
                    │ Port: 11434 │
                    └─────────────┘
```

---

## 🔧 Step-by-Step Setup

### 1. Install and Start Ollama (Optional - for AI features)

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai/download

# Start Ollama (usually runs automatically)
# Verify it's running:
curl http://localhost:11434/api/tags

# Pull required models (optional)
ollama pull qwen2.5:3b
ollama pull llama3.2:3b
```

**PowerShell (Windows):**
```powershell
Invoke-WebRequest -Uri http://localhost:11434/api/tags
```

### 2. Start FastAPI Ollama Service (Optional - for multimodal AI)

```bash
# Navigate to FastAPI Ollama service directory
cd Fast_API_Ollama

# Option 1: Quick Start (Recommended)
# Run the setup script to create venv and install dependencies
.\setup.ps1

# Then start the service
.\start.ps1

# Option 2: Manual Setup
# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
# venv\Scripts\activate.bat
# Linux/Mac:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Verify it's running:
curl http://localhost:8000/health
```

**Expected Response:**
```json
{"status": "ok"}
```

### 3. Configure Worker Service

```bash
# Navigate to worker directory
cd worker

# Copy environment file
cp env.example .env

# Edit .env file with your configuration
```

**Required `.env` Configuration:**

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ollama Configuration (Optional - for AI features)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_HOST=http://localhost:11434

# FastAPI Ollama Service (Optional - for multimodal AI)
PYTHON_BACKEND_URL=http://localhost:8000

# Server Configuration
PORT=3001
PUBLIC_BASE_URL=http://localhost:3001
WORKER_ID=worker-local
LOG_LEVEL=INFO
PROCESS_TIMEOUT_SECONDS=1800
MAX_RETRIES=3

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
ALLOWED_ORIGINS=*

# API Keys (Optional - for external AI services)
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 4. Install Dependencies

```bash
# Navigate to worker directory
cd worker

# Install Node.js dependencies
npm install
```

### 5. Start Worker Service

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm run build
npm start
```

**Expected Output:**
```
🚀 CtrlChecks Worker server running on port 3001
📡 Environment: development
🔗 Health check: http://localhost:3001/health

📋 Available API endpoints:
  POST /api/execute-workflow
  POST /api/webhook-trigger/:workflowId
  POST /api/chat-api
  GET  /api/form-trigger/:workflowId/:nodeId
  POST /api/form-trigger/:workflowId/:nodeId/submit
  POST /api/generate-workflow
  POST /api/execute-agent
  POST /api/chatbot
  POST /api/execute-multimodal-agent
  POST /api/build-multimodal-agent
  POST /api/analyze-workflow-requirements
  GET  /api/admin-templates
  POST /api/copy-template
```

### 6. Verify Health Check

**Bash/Linux/Mac:**
```bash
curl http://localhost:3001/health
```

**PowerShell (Windows):**
```powershell
Invoke-WebRequest -Uri http://localhost:3001/health | Select-Object -ExpandProperty Content
```

**Expected Response:**
```json
{"status": "ok", "timestamp": "2025-01-26T..."}
```

---

## ✅ Verification Checklist

### 1. Check Worker Service

**Bash/Linux/Mac:**
```bash
curl http://localhost:3001/health
```

**PowerShell (Windows):**
```powershell
Invoke-WebRequest -Uri http://localhost:3001/health | Select-Object -ExpandProperty Content
```

Should return `{"status": "ok", ...}`.

### 2. Test API Endpoints

**Test Health Endpoint:**
```powershell
# PowerShell
Invoke-RestMethod -Uri http://localhost:3001/health
```

**Test Execute Workflow (requires workflowId):**
```powershell
$body = @{
    workflowId = "your-workflow-id"
    input = @{
        test = "data"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/execute-workflow -Method POST -Body $body -ContentType "application/json"
```

**Test Chatbot:**
```powershell
$body = @{
    message = "Hello! What is CtrlChecks?"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/chatbot -Method POST -Body $body -ContentType "application/json"
```

### 3. Check Logs

The server should show:
- ✅ Server started successfully
- ✅ All routes registered
- ✅ No errors on startup

---

## 🔍 Troubleshooting

### Issue: "Cannot find module" errors

**Solution:**
```bash
cd worker
npm install
```

### Issue: "Port 3001 already in use"

**Solution:**
```bash
# Change port in .env file
PORT=3002

# Or kill the process using port 3001
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3001 | xargs kill
```

### Issue: "Supabase connection error"

**Solution:**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check Supabase project is active
- Verify network connectivity

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Check for type errors
npm run type-check

# Rebuild
npm run build
```

### Issue: CORS Errors in Frontend

**Solution:**
- Make sure `CORS_ORIGIN` or `ALLOWED_ORIGINS` in `.env` includes your frontend URL
- Default: `CORS_ORIGIN=http://localhost:5173`
- Or use: `ALLOWED_ORIGINS=*` for development

---

## 📝 Port Summary

| Service | Port | URL |
|---------|------|-----|
| Worker Service | 3001 | `http://localhost:3001` |
| Ollama (Optional) | 11434 | `http://localhost:11434` |
| FastAPI Ollama (Optional) | 8000 | `http://localhost:8000` |
| Frontend | 5173 | `http://localhost:5173` |

---

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
cd worker
npm install

# 2. Copy and configure environment
cp env.example .env
# Edit .env with your Supabase credentials

# 3. Start development server
npm run dev

# 4. In another terminal, test health check
curl http://localhost:3001/health
```

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ Server starts without errors
2. ✅ Health check returns `{"status": "ok"}`
3. ✅ All API endpoints are listed in startup logs
4. ✅ No TypeScript compilation errors
5. ✅ Frontend can make API calls to worker

---

## 📚 Available API Endpoints

- `GET /health` - Health check
- `POST /api/execute-workflow` - Execute a workflow
- `POST /api/webhook-trigger/:workflowId` - Trigger workflow via webhook
- `GET /api/form-trigger/:workflowId/:nodeId` - Get form configuration
- `POST /api/form-trigger/:workflowId/:nodeId/submit` - Submit form
- `POST /api/generate-workflow` - Generate workflow from prompt
- `POST /api/execute-agent` - Execute agent workflow
- `POST /api/chat-api` - Chat API for workflows
- `POST /api/chatbot` - Website chatbot
- `POST /api/execute-multimodal-agent` - Execute multimodal agent
- `POST /api/build-multimodal-agent` - Build multimodal agent
- `POST /api/analyze-workflow-requirements` - Analyze workflow requirements
- `GET /api/admin-templates` - List templates
- `POST /api/copy-template` - Copy template

---

## 🎯 Summary

**Your Node.js backend is ready for local development!**

1. ✅ Install dependencies: `npm install`
2. ✅ Configure environment: Copy `env.example` to `.env` and fill in values
3. ✅ Start server: `npm run dev`
4. ✅ Test health: `curl http://localhost:3001/health`

**All Supabase functions have been migrated to Node.js Express routes!**

---

**Last Updated:** January 26, 2025
