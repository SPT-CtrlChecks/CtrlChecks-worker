# 🧪 Testing API Endpoints in PowerShell

PowerShell's `curl` is an alias for `Invoke-WebRequest` which has different syntax than Unix curl.

---

## ✅ Quick Test Script

Use the provided test script:

```powershell
cd worker
.\test-api.ps1
```

This will test all endpoints automatically.

---

## 📝 Manual PowerShell Commands

### 1. Health Check

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Or prettier:
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 2. List AI Models

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/api/ai/models" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 3. AI Text Generation (POST)

```powershell
$body = @{
    prompt = "Hello, how are you?"
    model = "qwen2.5:3b"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/ai/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 4. AI Chat (POST)

```powershell
$body = @{
    messages = @(
        @{
            role = "user"
            content = "What is 2+2?"
        }
    )
    model = "qwen2.5:3b"
} | ConvertTo-Json -Depth 10

$response = Invoke-WebRequest -Uri "http://localhost:3001/api/ai/chat" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 5. AI Metrics

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3001/api/ai/metrics" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 🔄 Alternative: Use curl.exe (Windows 10+)

If you have Windows 10 or later, you can use the real curl:

```powershell
curl.exe -X POST http://localhost:3001/api/ai/generate `
  -H "Content-Type: application/json" `
  -d '{\"prompt\": \"Hello!\", \"model\": \"qwen2.5:3b\"}'
```

Note: Use `curl.exe` (not `curl`) to bypass PowerShell's alias.

---

## 🐛 Common Issues

### "A parameter cannot be found that matches parameter name 'X'"
- **Cause:** PowerShell's `curl` alias doesn't support `-X` flag
- **Fix:** Use `Invoke-WebRequest` or `curl.exe` instead

### "The term '-H' is not recognized"
- **Cause:** PowerShell doesn't support Unix curl syntax
- **Fix:** Use PowerShell syntax with `-ContentType` and `-Headers`

### "Script Execution Risk" warning
- **Fix:** Add `-UseBasicParsing` flag to avoid HTML parsing

---

## 📚 PowerShell vs Unix curl

| Unix curl | PowerShell Invoke-WebRequest |
|-----------|------------------------------|
| `curl -X POST` | `Invoke-WebRequest -Method POST` |
| `curl -H "Header: value"` | `Invoke-WebRequest -Headers @{"Header"="value"}` |
| `curl -d '{"key":"value"}'` | `Invoke-WebRequest -Body (ConvertTo-Json @{key="value"})` |
| `curl -H "Content-Type: application/json"` | `Invoke-WebRequest -ContentType "application/json"` |

---

## ✅ Recommended: Use the Test Script

The easiest way is to use the provided test script:

```powershell
cd worker
.\test-api.ps1
```

This tests all endpoints and shows results in a readable format.
