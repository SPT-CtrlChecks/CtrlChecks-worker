# ✅ Setup Verification Checklist

Use this checklist to verify your setup is complete.

---

## 🔐 Environment Variables

- [x] `SUPABASE_URL` - Your Supabase project URL
- [x] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (secret!)
- [x] `OLLAMA_HOST` - Ollama endpoint (default: http://localhost:11434)
- [x] `PORT` - Backend port (default: 3001)

---

## 🗄️ Supabase Database

### Tables Created
- [ ] `workflows` - Workflow storage
- [ ] `executions` - Execution records
- [ ] `templates` - Workflow templates
- [ ] `profiles` - User profiles
- [ ] `user_roles` - User roles
- [ ] `form_submissions` - Form data
- [ ] `agent_executions` - AI agent executions
- [ ] `memory_sessions` - Conversation sessions
- [ ] `memory_messages` - Conversation messages
- [ ] `google_oauth_tokens` - Google OAuth tokens

### Verify in Supabase Dashboard
1. Go to **Table Editor**
2. Check that all tables listed above exist
3. Verify RLS (Row Level Security) is enabled

---

## 🤖 Ollama Setup

- [ ] Ollama is running: `ollama serve`
- [ ] Recommended models are pulled:
  - `qwen2.5:3b`
  - `codellama:7b`
  - `llava:latest`
- [ ] Test: `ollama list` shows models

---

## 🐍 FastAPI Ollama Service (Optional)

- [ ] Python virtual environment created
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Service can start: `uvicorn main:app --host 0.0.0.0 --port 8000`

---

## 🚀 Backend Server

### Start the Server
```bash
cd worker
npm run dev
```

### Expected Output
```
🤖 Initializing Ollama AI services...
✅ Ollama connected at http://localhost:11434
📦 Loaded models: ...
✅ Ollama AI services initialized

🚀 CtrlChecks Worker server running on port 3001
📡 Environment: development
🔗 Health check: http://localhost:3001/health
```

### Test Endpoints

1. **Health Check:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status": "healthy", "ollama": "connected", ...}`

2. **List AI Models:**
   ```bash
   curl http://localhost:3001/api/ai/models
   ```
   Should return available Ollama models

3. **Test AI Generation:**
   ```bash
   curl -X POST http://localhost:3001/api/ai/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello, how are you?", "model": "qwen2.5:3b"}'
   ```

---

## ✅ Success Indicators

- [ ] Server starts without errors
- [ ] Health check returns `healthy` status
- [ ] Ollama connection successful
- [ ] No Supabase connection errors
- [ ] Scheduler service starts (or skips gracefully)
- [ ] All API endpoints are listed in console

---

## 🐛 Common Issues

### "Supabase URL and Service Role Key are required"
- **Fix:** Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **Location:** `worker/.env`

### "Ollama connection failed"
- **Fix:** Start Ollama: `ollama serve`
- **Fix:** Check `OLLAMA_HOST` in `.env` matches your Ollama URL

### "relation does not exist"
- **Fix:** Run SQL migrations in Supabase
- **Start with:** `ctrl_checks/sql_migrations/01_database_setup.sql`

### Scheduler errors
- **Fix:** Make sure `workflows` table exists
- **Fix:** Scheduler will skip gracefully if Supabase isn't configured

---

## 📝 Next Steps

After verification:

1. ✅ Test creating a workflow
2. ✅ Test executing a workflow
3. ✅ Test AI endpoints
4. ✅ Test form submissions
5. ✅ Test scheduled workflows

---

**Status:** Ready to use! 🎉
