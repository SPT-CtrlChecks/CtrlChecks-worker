// Environment Configuration for CtrlChecks Worker

export const config: any = {
  // Database
  databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  
  // Supabase (if still using for auth)
  // Support both standard naming and VITE_ prefix (for shared .env files)
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Ollama
  ollamaHost: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  
  // Redis (if used)
  redisUrl: process.env.REDIS_URL,
  
  // Port
  port: parseInt(process.env.PORT || '3001', 10),
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
  
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
  
  // Google OAuth
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  
  // Other
  lovableApiKey: process.env.LOVABLE_API_KEY,
  webhookSecret: process.env.WEBHOOK_SECRET,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3001',
  workerId: process.env.WORKER_ID || 'worker-local',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  processTimeoutSeconds: parseInt(process.env.PROCESS_TIMEOUT_SECONDS || '1800', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
};
