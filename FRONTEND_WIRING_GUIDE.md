# Frontend Wiring Guide - Connecting to FastAPI Backend

This guide explains how to connect your React frontend to the FastAPI backend deployed on EC2.

---

## Overview

The frontend must be configured to call the FastAPI backend directly instead of Supabase Edge Functions. All API calls should go to:

```
https://api.yourdomain.com
```

---

## Step 1: Environment Variables

### Development (.env.local)

Create or update `.env.local` in your frontend root:

```env
VITE_PYTHON_BACKEND_URL=http://localhost:8000
VITE_PUBLIC_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Production (Build-time)

Set these environment variables when building your frontend:

```bash
VITE_PYTHON_BACKEND_URL=https://api.yourdomain.com
VITE_PUBLIC_BASE_URL=https://api.yourdomain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**For Vercel/Netlify:**
- Go to Project Settings → Environment Variables
- Add each variable above
- Redeploy

**For manual build:**
```bash
export VITE_PYTHON_BACKEND_URL=https://api.yourdomain.com
export VITE_PUBLIC_BASE_URL=https://api.yourdomain.com
npm run build
```

---

## Step 2: Verify Endpoints Configuration

Check `src/config/endpoints.ts`:

```typescript
export const ENDPOINTS = {
    // The main backend URL (FastAPI)
    itemBackend: ensureProtocol(getEnvVar('VITE_PYTHON_BACKEND_URL', 'http://localhost:8000')),
    
    // Ollama URL (often proxies through the backend or is same as backend)
    ollamaBase: ensureProtocol(getEnvVar('VITE_OLLAMA_BASE_URL', getEnvVar('VITE_PYTHON_BACKEND_URL', 'http://localhost:11434'))),
    
    // Backend access mode
    useDirectBackend: import.meta.env.VITE_USE_DIRECT_BACKEND === 'true' || import.meta.env.DEV || !import.meta.env.VITE_SUPABASE_URL
};
```

**This should already be correct** - it uses `VITE_PYTHON_BACKEND_URL` which we set above.

---

## Step 3: API Endpoints Reference

All endpoints are relative to `ENDPOINTS.itemBackend`:

### Workflow Generation

```typescript
// Generate workflow
POST ${ENDPOINTS.itemBackend}/generate-workflow
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "prompt": "Create a chatbot workflow",
  "mode": "analyze" | "refine" | "create" | "edit"
}

// Check workflow generation status
GET ${ENDPOINTS.itemBackend}/workflow-status/{job_id}
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>"
}
```

### Workflow Execution

```typescript
// Execute workflow
POST ${ENDPOINTS.itemBackend}/execute-workflow
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "workflowId": "wf_123",
  "input": {}
}

// Execute single node (debug)
POST ${ENDPOINTS.itemBackend}/execute-node
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "runId": "run_123",
  "nodeId": "node_123",
  "nodeType": "llm_call",
  "config": {},
  "input": {},
  "workflowId": "wf_123"
}
```

### Chat API

```typescript
POST ${ENDPOINTS.itemBackend}/chat-api
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "workflowId": "wf_123",
  "message": "Hello",
  "sessionId": "session_123" // optional
}
```

### Multimodal Agent

```typescript
POST ${ENDPOINTS.itemBackend}/execute-multimodal-agent
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "input": "Process this image",
  "pipeline": {...},
  "models": [...]
}
```

### Templates

```typescript
// Copy template
POST ${ENDPOINTS.itemBackend}/copy-template
Headers: {
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
Body: {
  "templateId": "template_123",
  "workflowName": "My Workflow" // optional
}
```

### Webhooks

```typescript
// Trigger webhook
POST ${ENDPOINTS.itemBackend}/webhook-trigger/{workflow_id}
Headers: {
  "Content-Type": "application/json"
  // No auth required for public webhooks
}
Body: {
  "event": "created",
  "data": {...}
}
```

### Form Triggers

```typescript
// Get form configuration
GET ${ENDPOINTS.itemBackend}/form-trigger/{workflow_id}/{node_id}
// No auth required

// Submit form
POST ${ENDPOINTS.itemBackend}/form-trigger/{workflow_id}/{node_id}/submit
Headers: {
  "Content-Type": "application/json",
  "X-Idempotency-Key": "unique-key-123"
}
Body: {
  "formData": {...}
}
```

### Health

```typescript
// Basic health
GET ${ENDPOINTS.itemBackend}/health
// No auth required

// Ollama health
GET ${ENDPOINTS.itemBackend}/health/ollama
// No auth required
```

---

## Step 4: Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const response = await fetch(`${ENDPOINTS.itemBackend}/generate-workflow`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt, mode: 'analyze' })
});
```

**Note:** The frontend should use Supabase Auth to get the JWT token, then pass it to the FastAPI backend.

---

## Step 5: CORS Configuration

The backend CORS is configured in `worker/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origins],  # From .env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**On the server, set in `/opt/ctrlchecks/.env`:**

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Important:** 
- Use comma-separated list (no spaces)
- Include both `www` and non-`www` if applicable
- Use `https://` protocol
- No trailing slashes

---

## Step 6: Error Handling

The backend returns standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

**Error response format:**
```json
{
  "error": "Error message",
  "detail": "Additional details" // optional
}
```

**Example error handling in frontend:**
```typescript
try {
  const response = await fetch(`${ENDPOINTS.itemBackend}/generate-workflow`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, mode: 'analyze' })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || 'Request failed');
  }

  const data = await response.json();
  return data;
} catch (error: any) {
  console.error('API Error:', error);
  throw error;
}
```

---

## Step 7: Testing Connection

### Test 1: Health Endpoint

```typescript
const response = await fetch(`${ENDPOINTS.itemBackend}/health`);
const data = await response.json();
console.log('Health:', data); // Should be { status: "ok" }
```

### Test 2: Authenticated Endpoint

```typescript
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(`${ENDPOINTS.itemBackend}/generate-workflow`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt: 'test', mode: 'analyze' })
});

if (!response.ok) {
  console.error('Auth failed:', await response.text());
} else {
  console.log('Auth successful:', await response.json());
}
```

### Test 3: Check Browser Network Tab

1. Open browser DevTools → Network tab
2. Make a request from your frontend
3. Verify:
   - Request URL is `https://api.yourdomain.com/...`
   - Request includes `Authorization: Bearer ...` header
   - Response status is `200`
   - Response body is valid JSON

---

## Step 8: Common Issues

### Issue: CORS Error

**Symptoms:**
```
Access to fetch at 'https://api.yourdomain.com/...' from origin 'https://yourdomain.com' has been blocked by CORS policy
```

**Solution:**
1. Verify `ALLOWED_ORIGINS` in backend `.env` includes your frontend domain
2. Restart backend: `sudo systemctl restart ctrlchecks`
3. Verify no trailing slashes in CORS origins
4. Check browser console for exact origin being blocked

### Issue: 401 Unauthorized

**Symptoms:**
```
{"error": "Unauthorized"}
```

**Solution:**
1. Verify JWT token is being sent: Check Network tab → Request Headers
2. Verify token is valid: Check token expiration
3. Verify backend JWT keys are correct in `.env`
4. Test token with: `curl -H "Authorization: Bearer <token>" https://api.yourdomain.com/health`

### Issue: 502 Bad Gateway

**Symptoms:**
```
502 Bad Gateway
```

**Solution:**
1. Backend service is down: `sudo systemctl status ctrlchecks`
2. Backend not listening on port 8000: `curl http://localhost:8000/health` (on server)
3. Nginx configuration error: `sudo nginx -t`
4. Check backend logs: `sudo journalctl -u ctrlchecks -n 50`

### Issue: Network Error / Connection Refused

**Symptoms:**
```
Failed to fetch
NetworkError when attempting to fetch resource
```

**Solution:**
1. Verify `VITE_PYTHON_BACKEND_URL` is set correctly
2. Verify domain DNS points to EC2 IP
3. Verify security group allows HTTPS (port 443)
4. Test from browser: `https://api.yourdomain.com/health`

---

## Step 9: Migration Checklist

- [ ] Frontend `.env.local` updated with `VITE_PYTHON_BACKEND_URL`
- [ ] Production build environment variables set
- [ ] All `supabase.functions.invoke` calls replaced with `fetch` to `ENDPOINTS.itemBackend`
- [ ] All API calls include `Authorization: Bearer <token>` header
- [ ] CORS configured on backend with frontend domain
- [ ] Health endpoint tested from browser
- [ ] Authenticated endpoint tested from browser
- [ ] Network tab shows requests going to correct domain
- [ ] No CORS errors in browser console
- [ ] No 401/403 errors (authentication working)
- [ ] Workflow generation tested end-to-end
- [ ] Workflow execution tested end-to-end
- [ ] Chat API tested
- [ ] Form triggers tested
- [ ] Webhooks tested

---

## Step 10: Example Frontend Code

### Using Fetch

```typescript
import { ENDPOINTS } from '@/config/endpoints';
import { supabase } from '@/lib/supabase';

async function generateWorkflow(prompt: string, mode: 'analyze' | 'refine' | 'create') {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${ENDPOINTS.itemBackend}/generate-workflow`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, mode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Failed to generate workflow');
  }

  return await response.json();
}
```

### Using Axios (if you prefer)

```typescript
import axios from 'axios';
import { ENDPOINTS } from '@/config/endpoints';
import { supabase } from '@/lib/supabase';

const apiClient = axios.create({
  baseURL: ENDPOINTS.itemBackend,
});

// Add auth interceptor
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

async function generateWorkflow(prompt: string, mode: 'analyze' | 'refine' | 'create') {
  const response = await apiClient.post('/generate-workflow', { prompt, mode });
  return response.data;
}
```

---

## Summary

1. **Set environment variables:** `VITE_PYTHON_BACKEND_URL=https://api.yourdomain.com`
2. **Use `ENDPOINTS.itemBackend`** for all API calls
3. **Include JWT token** in `Authorization: Bearer <token>` header
4. **Configure CORS** on backend with your frontend domain
5. **Test connection** with health endpoint first
6. **Monitor Network tab** to verify requests

---

**End of Frontend Wiring Guide**
