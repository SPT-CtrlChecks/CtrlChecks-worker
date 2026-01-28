# CtrlChecks Worker - Node.js Backend

Unified Node.js/Express backend for CtrlChecks, migrated from Supabase Edge Functions.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp env.example .env
# Edit .env with your Supabase credentials

# 3. Start development server
npm run dev
```

## 📋 Available API Endpoints

- `GET /health` - Health check
- `POST /api/execute-workflow` - Execute a workflow
- `POST /api/webhook-trigger/:workflowId` - Trigger workflow via webhook
- `GET /api/form-trigger/:workflowId/:nodeId` - Get form configuration
- `POST /api/form-trigger/:workflowId/:nodeId/submit` - Submit form
- `POST /api/generate-workflow` - Generate workflow from prompt
- `POST /api/execute-agent` - Execute agent workflow
- `POST /api/chat-api` - Chat API for workflows
- `POST /api/chatbot` - Website chatbot
- `POST /api/analyze-workflow-requirements` - Analyze workflow requirements
- `GET /api/admin-templates` - List templates
- `POST /api/copy-template` - Copy template

## 📁 Project Structure

```
worker/
├── src/
│   ├── api/              # API route handlers (12 routes)
│   ├── core/              # Core utilities (config, database, middleware)
│   ├── shared/            # Shared utilities (LLM, memory, reasoning, etc.)
│   ├── services/          # Services (scheduler, workflow-executor)
│   ├── data/              # Data files (knowledge base)
│   └── index.ts           # Main server file
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── env.example            # Environment variables template
```

## 🔧 Development

```bash
# Development mode (with auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check
```

## 📚 Documentation

- **QUICK_START.md** - Quick setup guide
- **LOCAL_DEVELOPMENT_SETUP.md** - Detailed local development guide
- **MIGRATION_COMPLETE.md** - Migration status from Supabase
- **CLEANUP_COMPLETE.md** - Cleanup summary

## ✅ Migration Status

**All 12 Supabase Edge Functions migrated:**
- ✅ execute-workflow
- ✅ webhook-trigger
- ✅ form-trigger
- ✅ generate-workflow
- ✅ execute-agent
- ✅ chat-api
- ✅ chatbot
- ✅ analyze-workflow-requirements
- ✅ admin-templates
- ✅ copy-template

## 🔐 Environment Variables

See `env.example` for required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `PORT` - Server port (default: 3001)
- `CORS_ORIGIN` - CORS origin (default: http://localhost:5173)

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Or PowerShell:
Invoke-RestMethod -Uri http://localhost:3001/health
```

## 📝 License

ISC
