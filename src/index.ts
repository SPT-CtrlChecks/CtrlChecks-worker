// Main Express.js Server for CtrlChecks Worker
// Migrated from Supabase Edge Functions
// Ollama-First AI Architecture

// IMPORTANT: Load environment variables FIRST before any other imports
// This ensures process.env is populated before config.ts reads it
import './core/env-loader';

import express, { Express, Request, Response } from 'express';
import { networkInterfaces } from 'os';
import { config } from './core/config';
import { corsMiddleware } from './core/middleware/cors';
import { errorHandler, asyncHandler } from './core/middleware/error-handler';

// Initialize Ollama AI Services
import { ollamaManager } from './services/ai/ollama-manager';
import { modelManager } from './services/ai/model-manager';
import { metricsTracker } from './services/ai/metrics-tracker';

// Import route handlers
import executeWorkflowRoute from './api/execute-workflow';
import webhookTriggerRoute from './api/webhook-trigger';
import chatApiRoute from './api/chat-api';
import adminTemplatesRoute from './api/admin-templates';
import copyTemplateRoute from './api/copy-template';
import formTriggerRoute from './api/form-trigger';
import generateWorkflowRoute from './api/generate-workflow';
import executeAgentRoute from './api/execute-agent';
import chatbotRoute from './api/chatbot';
import analyzeWorkflowRequirementsRoute from './api/analyze-workflow-requirements';
import processRoute from './api/process';
import executeNodeRoute from './api/execute-node';
import aiGateway from './api/ai-gateway';
import * as trainingStats from './api/training-stats';



const app: Express = express();

// === ENHANCED LOGGING MIDDLEWARE ===
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const origin = req.headers.origin || 'no-origin';
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms [${origin}]`);
  });
  next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(corsMiddleware);

// Health check with Ollama status
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const ollamaHealth = await ollamaManager.healthCheck();
  const stats = metricsTracker.getStats();
  
  res.json({
    status: ollamaHealth.healthy ? 'healthy' : 'degraded',
    backend: 'running',
    ollama: ollamaHealth.healthy ? 'connected' : 'disconnected',
    ollamaEndpoint: ollamaHealth.endpoint,
    models: ollamaHealth.models,
    aiMetrics: {
      totalRequests: stats.totalRequests,
      successRate: `${stats.successRate.toFixed(1)}%`,
      averageResponseTime: `${stats.averageResponseTime.toFixed(0)}ms`,
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: config.port,
    endpoints: [
      '/api/execute-workflow',
      '/api/webhook-trigger',
      '/api/chat-api',
      '/api/form-trigger',
      '/api/generate-workflow',
      '/api/execute-agent',
      '/api/chatbot',
      '/api/analyze-workflow-requirements',
      '/api/ai/generate',
      '/api/ai/chat',
      '/api/ai/analyze-image',
      '/api/ai/models',
      '/api/ai/metrics',
      '/api/training/stats',
      '/api/training/categories',
      '/api/training/workflows',
      '/api/training/similar',
      '/api/training/examples',
      '/process',
      '/execute-node',
      '/api/execute-node',
      '/api/admin-templates',
      '/api/copy-template',
    ],
  });
}));

// Connection test endpoint
app.get('/api/test-connection', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Backend is running and reachable',
    timestamp: new Date().toISOString(),
    frontendUrl: req.headers.origin || 'unknown',
    backendUrl: `${req.protocol}://${req.get('host')}`,
  });
}));

// API Routes
app.post('/api/execute-workflow', asyncHandler(executeWorkflowRoute));
app.post('/api/webhook-trigger/:workflowId', asyncHandler(webhookTriggerRoute));
app.get('/api/webhook-trigger/:workflowId', asyncHandler(webhookTriggerRoute));
app.post('/api/chat-api', asyncHandler(chatApiRoute));
app.get('/api/admin-templates', asyncHandler(adminTemplatesRoute));
app.get('/api/admin-templates/:id', asyncHandler(adminTemplatesRoute));
app.post('/api/admin-templates', asyncHandler(adminTemplatesRoute));
app.put('/api/admin-templates/:id', asyncHandler(adminTemplatesRoute));
app.delete('/api/admin-templates/:id', asyncHandler(adminTemplatesRoute));
app.post('/api/copy-template', asyncHandler(copyTemplateRoute));

// Form Trigger Routes - More specific route first
app.get('/api/form-trigger/:workflowId/:nodeId', asyncHandler(formTriggerRoute));
app.post('/api/form-trigger/:workflowId/:nodeId/submit', asyncHandler(formTriggerRoute));

// Workflow Generation
app.post('/api/generate-workflow', asyncHandler(generateWorkflowRoute));

// Agent Routes
app.post('/api/execute-agent', asyncHandler(executeAgentRoute));

// Chatbot
app.post('/api/chatbot', asyncHandler(chatbotRoute));
app.post('/chatbot', asyncHandler(chatbotRoute)); // Alias for frontend compatibility


// Process Route - Direct proxy to FastAPI backend
app.post('/process', asyncHandler(processRoute));

// Workflow Analysis
app.post('/api/analyze-workflow-requirements', asyncHandler(analyzeWorkflowRequirementsRoute));

// Debug Node Execution (for Debug Panel)
app.post('/execute-node', asyncHandler(executeNodeRoute));
app.post('/api/execute-node', asyncHandler(executeNodeRoute)); // Also support /api prefix

// AI Gateway - Unified AI Services
app.use('/api/ai', aiGateway);
console.log('🤖 AI Gateway available at /api/ai');

// Training Statistics API
app.get('/api/training/stats', asyncHandler(trainingStats.getTrainingStats));
app.get('/api/training/categories', asyncHandler(trainingStats.getTrainingCategories));
app.get('/api/training/workflows', asyncHandler(trainingStats.getTrainingWorkflows));
app.post('/api/training/similar', asyncHandler(trainingStats.findSimilarWorkflows));
app.get('/api/training/examples', asyncHandler(trainingStats.getTrainingExamples));
app.get('/api/training/usage', asyncHandler(trainingStats.getTrainingUsage));
app.post('/api/training/reload', asyncHandler(trainingStats.reloadTrainingDataset));
console.log('📚 Training API available at /api/training/*');

// AI Endpoints (Ollama-First)
app.post('/api/ai/generate', asyncHandler(async (req: Request, res: Response) => {
  const { prompt, model, system, temperature, max_tokens } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  const result = await ollamaManager.generate(prompt, {
    model,
    system,
    temperature,
    max_tokens,
    stream: false,
  });

  res.json({ success: true, result });
}));

app.post('/api/ai/chat', asyncHandler(async (req: Request, res: Response) => {
  const { messages, model, temperature } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, error: 'Messages array is required' });
  }

  const result = await ollamaManager.chat(messages, {
    model,
    temperature,
    stream: false,
  });

  res.json({ success: true, result });
}));

app.post('/api/ai/analyze-image', asyncHandler(async (req: Request, res: Response) => {
  // Multimodal functionality has been removed
  res.status(501).json({ 
    success: false, 
    error: 'Image analysis functionality has been removed. Multimodal features are no longer supported.' 
  });
}));

app.get('/api/ai/models', asyncHandler(async (req: Request, res: Response) => {
  const models = await ollamaManager.getAvailableModels();
  const stats = modelManager.getUsageStats();
  
  res.json({
    success: true,
    models,
    recommended: modelManager.getRecommendedModels(),
    usageStats: stats,
  });
}));

app.get('/api/ai/metrics', asyncHandler(async (req: Request, res: Response) => {
  const stats = metricsTracker.getStats();
  res.json({ success: true, metrics: stats });
}));

// Error handler (must be last)
app.use(errorHandler);

// === NETWORK INTERFACE DISCOVERY ===
function getNetworkAddresses(port: number): string[] {
  const interfaces = networkInterfaces();
  const addresses: string[] = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(`http://${iface.address}:${port}`);
      }
    }
  }
  
  return addresses;
}

// === ENHANCED ERROR HANDLING ===
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  // Don't exit, try to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Ollama and start server
async function startServer() {
  try {
    // Initialize Ollama Manager
    console.log('🤖 Initializing Ollama AI services...');
    await ollamaManager.initialize();
    
    // Initialize Model Manager
    await modelManager.initialize();
    
    console.log('✅ Ollama AI services initialized');
    console.log(`📦 Recommended models: ${modelManager.getRecommendedModels().join(', ')}`);
  } catch (error) {
    console.error('⚠️  Ollama initialization failed:', error);
    console.log('⚠️  Server will start but AI features may be unavailable');
    console.log('💡 Make sure Ollama is running at:', config.ollamaHost);
  }

  // Start server
  const PORT = config.port;
  
  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      const networkAddresses = getNetworkAddresses(PORT);
      
      console.log('\n' + '='.repeat(60));
      console.log('🚀 CtrlChecks Worker Backend');
      console.log('='.repeat(60));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      console.log('\n🌐 Available URLs:');
      console.log(`   Local:    http://localhost:${PORT}`);
      console.log(`   Network:  http://127.0.0.1:${PORT}`);
      if (networkAddresses.length > 0) {
        networkAddresses.forEach(addr => console.log(`   Network:  ${addr}`));
      }
      
      console.log('\n🛣️  API Endpoints:');
      console.log(`   Health:   http://localhost:${PORT}/health`);
      console.log(`   Test:     http://localhost:${PORT}/api/test-connection`);
      console.log(`   Execute:  http://localhost:${PORT}/api/execute-workflow`);
      console.log(`   Chatbot:  http://localhost:${PORT}/api/chatbot`);
      
      console.log('\n🔗 CORS Configuration:');
      console.log(`   Allowed origins: http://localhost:5173, http://localhost:8080, http://127.0.0.1:5173`);
      if (config.corsOrigin) {
        console.log(`   Custom origin: ${config.corsOrigin}`);
      }
      
      console.log(`\n🤖 Ollama endpoint: ${config.ollamaHost}`);
      
      console.log('\n📋 All Available Endpoints:');
      console.log(`  POST /api/execute-workflow`);
      console.log(`  POST /api/webhook-trigger/:workflowId`);
      console.log(`  POST /api/chat-api`);
      console.log(`  GET  /api/form-trigger/:workflowId/:nodeId`);
      console.log(`  POST /api/form-trigger/:workflowId/:nodeId/submit`);
      console.log(`  POST /api/generate-workflow`);
      console.log(`  POST /api/execute-agent`);
      console.log(`  POST /api/chatbot`);
      console.log(`  POST /chatbot`);
      console.log(`  POST /api/analyze-workflow-requirements`);
      console.log(`  POST /process - Proxy to FastAPI backend`);
      console.log(`  POST /execute-node - Debug single node execution`);
      console.log(`  POST /api/execute-node - Debug single node execution`);
      console.log(`  GET  /api/admin-templates`);
      console.log(`  POST /api/copy-template`);
      console.log(`  POST /api/ai/generate - Text generation`);
      console.log(`  POST /api/ai/chat - Chat completion`);
      console.log(`  POST /api/ai/analyze-image - Image analysis`);
      console.log(`  GET  /api/ai/models - List available models`);
      console.log(`  GET  /api/ai/metrics - AI performance metrics`);
      console.log(`\n📚 Training API Endpoints:`);
      console.log(`  GET  /api/training/stats - Training dataset statistics`);
      console.log(`  GET  /api/training/categories - Available workflow categories`);
      console.log(`  GET  /api/training/workflows - Get workflows by category`);
      console.log(`  POST /api/training/similar - Find similar workflows`);
      console.log(`  GET  /api/training/examples - Get training examples for few-shot learning`);
      console.log(`  GET  /api/training/usage - Get training usage metrics`);
      console.log(`  POST /api/training/reload - Reload training dataset (hot reload)`);
      console.log(`\n🤖 AI Gateway Endpoints:`);
      console.log(`  POST /api/ai/chatbot/message - Chichu chatbot`);
      console.log(`  POST /api/ai/editor/suggest-improvements - Workflow node suggestions`);
      console.log(`  POST /api/ai/builder/generate-from-prompt - Generate workflow from prompt`);
      console.log(`  POST /api/ai/ollama/generate - Direct Ollama generation`);
      console.log(`  GET  /api/ai/metrics - Performance metrics`);
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ Backend ready to accept connections!');
      console.log('='.repeat(60) + '\n');
      
      // Start scheduler service
      if (process.env.ENABLE_SCHEDULER !== 'false') {
        import('./services/scheduler').then(({ schedulerService }) => {
          schedulerService.start();
        });
      }
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error('   Try one of these solutions:');
        console.error(`   Windows: netstat -ano | findstr :${PORT}`);
        console.error(`   Then: taskkill /PID <PID> /F`);
        console.error(`   Or change PORT in .env file`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;
