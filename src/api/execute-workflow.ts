// Execute Workflow API Route
// Migrated from Supabase Edge Function with correct state propagation

import { Request, Response } from 'express';
import { getSupabaseClient } from '../core/database/supabase-compat';
import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../core/config';
import { LLMAdapter } from '../shared/llm-adapter';
import { HuggingFaceRouterClient } from '../shared/huggingface-client';
import { getGoogleAccessToken, executeGoogleSheetsOperation } from '../shared/google-sheets';
import { LRUNodeOutputsCache } from '../core/cache/lru-node-outputs-cache';
import { validationMiddleware } from '../core/validation/validation-middleware';
import { safeParse, safeDeepClone } from '../shared/safe-json';
import { getExecutionStateManager } from '../services/workflow-executor/execution-state-manager';
import { VisualizationService } from '../services/workflow-executor/visualization-service';

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    type: string;
    category: string;
    config: Record<string, unknown>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

/**
 * Topological sort to determine execution order
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};
  const nodeMap: Record<string, WorkflowNode> = {};

  nodes.forEach(node => {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
    nodeMap[node.id] = node;
  });

  edges.forEach(edge => {
    adjacency[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  const queue: string[] = [];
  Object.entries(inDegree).forEach(([nodeId, degree]) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap[nodeId]);

    adjacency[nodeId].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  return sorted;
}

/**
 * Extract input object from unknown input type
 */
function extractInputObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (Array.isArray(input)) {
    return { items: input, data: input, array: input };
  }
  return { value: input, data: input };
}

/**
 * Get string property from config or object
 */
function getStringProperty(obj: Record<string, unknown>, key: string, defaultValue: string = ''): string {
  const value = obj[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return defaultValue;
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (typeof current !== 'object') {
      return undefined;
    }
    
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Resolve template variables in string (e.g., "Hello {{name}}" or "{{input.value}}" or "{{$json.value1}}")
 * Supports:
 * - {{key}} - direct context access
 * - {{key.field}} - nested object access
 * - {{$json.path}} - n8n-style $json syntax (maps to input/context data)
 * - {{input.path}} - input object access
 * 
 * Phase 3: Enhanced with template validation and helpful suggestions
 */
function resolveTemplate(template: string, context: Record<string, unknown>, nodeId?: string): string {
  // First, ensure $json and json aliases point to the input/context data
  // The primary data source is typically in 'input' or spread at root level
  const jsonData = context.input || context.json || context.$json || context;
  
  // Add $json and json aliases to context if not present
  const enrichedContext: Record<string, unknown> = {
    ...context,
    $json: jsonData,
    json: jsonData,
  };
  
  // Flatten all node outputs into context for easier access
  const flattenedContext: Record<string, unknown> = { ...enrichedContext };
  
  // Extract values from nested objects in context
  for (const [key, value] of Object.entries(enrichedContext)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      // Add nested properties as top-level keys (e.g., input.name -> input_name)
      for (const [nestedKey, nestedValue] of Object.entries(obj)) {
        flattenedContext[`${key}_${nestedKey}`] = nestedValue;
        // Also support dot notation in template
        flattenedContext[`${key}.${nestedKey}`] = nestedValue;
      }
    }
  }
  
  // Helper function to find similar field names (for suggestions)
  function findSimilarFields(path: string, availableFields: string[]): string[] {
    const pathLower = path.toLowerCase();
    const suggestions: Array<{ field: string; score: number }> = [];
    
    for (const field of availableFields) {
      const fieldLower = field.toLowerCase();
      let score = 0;
      
      // Exact match
      if (fieldLower === pathLower) {
        score = 100;
      }
      // Starts with
      else if (fieldLower.startsWith(pathLower) || pathLower.startsWith(fieldLower)) {
        score = 80;
      }
      // Contains
      else if (fieldLower.includes(pathLower) || pathLower.includes(fieldLower)) {
        score = 60;
      }
      // Levenshtein-like (simple character overlap)
      else {
        const commonChars = [...pathLower].filter(c => fieldLower.includes(c)).length;
        score = (commonChars / Math.max(pathLower.length, fieldLower.length)) * 40;
      }
      
      if (score > 30) {
        suggestions.push({ field, score });
      }
    }
    
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.field);
  }
  
  // Also add all properties from jsonData directly to flattenedContext for direct access (e.g., {{rows}})
  if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    const inputData = jsonData as Record<string, unknown>;
    for (const [key, value] of Object.entries(inputData)) {
      // Only add if not already in flattenedContext to avoid overwriting
      if (!(key in flattenedContext)) {
        flattenedContext[key] = value;
      }
    }
  }
  
  // Support multiple template patterns: {{key}}, {{key.field}}, {{$json.path}}, {{input.path}}
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    let resolvedValue: unknown = undefined;
    let resolved = false;
    
    // Handle $json syntax: {{$json.value1}} or {{$json.path.to.value}}
    if (trimmedPath.startsWith('$json.')) {
      const jsonPath = trimmedPath.substring(6); // Remove '$json.' prefix
      resolvedValue = getNestedValue(jsonData, jsonPath);
      if (resolvedValue !== null && resolvedValue !== undefined) {
        resolved = true;
      }
    }
    // Handle json syntax: {{json.value1}}
    else if (trimmedPath.startsWith('json.')) {
      const jsonPath = trimmedPath.substring(5); // Remove 'json.' prefix
      resolvedValue = getNestedValue(jsonData, jsonPath);
      if (resolvedValue !== null && resolvedValue !== undefined) {
        resolved = true;
      }
    }
    // Handle input. syntax: {{input.property}} or {{input.nested.property}}
    else if (trimmedPath.startsWith('input.')) {
      const inputPath = trimmedPath.substring(6); // Remove 'input.' prefix
      resolvedValue = getNestedValue(jsonData, inputPath);
      if (resolvedValue !== null && resolvedValue !== undefined) {
        resolved = true;
      }
    }
    // Try direct access first (e.g., {{rows}}, {{message}})
    else if (flattenedContext[trimmedPath] !== undefined) {
      resolvedValue = flattenedContext[trimmedPath];
      if (resolvedValue !== null && resolvedValue !== undefined) {
        resolved = true;
      }
    }
    // Try accessing from input object directly (e.g., {{rows}} might be input.rows)
    else if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
      const inputData = jsonData as Record<string, unknown>;
      if (inputData[trimmedPath] !== undefined) {
        resolvedValue = inputData[trimmedPath];
        if (resolvedValue !== null && resolvedValue !== undefined) {
          resolved = true;
        }
      }
    }
    // Try dot notation (e.g., input.name)
    else {
      const parts = trimmedPath.split('.');
      let current: unknown = enrichedContext;
      
      for (const part of parts) {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
          break;
        }
      }
      
      if (current !== null && current !== undefined) {
        resolvedValue = current;
        resolved = true;
      }
    }
    
    // If resolved, return the value
    if (resolved && resolvedValue !== null && resolvedValue !== undefined) {
      // Phase 3: Validate template value
      const validation = validationMiddleware.validateTemplateValue(
        match,
        resolvedValue,
        enrichedContext
      );
      
      if (!validation.valid && validation.error) {
        // Log validation warning but still return resolved value (non-strict mode)
        console.warn(`[Template Validation] ${nodeId ? `Node ${nodeId}: ` : ''}${validation.error}`);
      }
      
      return String(resolvedValue);
    }
    
    // Path not found - Phase 3: Provide helpful suggestions
    if (process.env.NODE_ENV === 'development' || process.env.VALIDATE_TEMPLATES !== 'false') {
      const availableFields = Object.keys(flattenedContext).slice(0, 20); // Limit for performance
      const suggestions = findSimilarFields(trimmedPath, availableFields);
      
      let errorMessage = `Template '${match}' references non-existent field '${trimmedPath}'`;
      
      if (suggestions.length > 0) {
        errorMessage += `. Did you mean: ${suggestions.map(s => `{{${s}}}`).join(', ')}?`;
      } else if (availableFields.length > 0) {
        errorMessage += `. Available fields: ${availableFields.slice(0, 5).join(', ')}${availableFields.length > 5 ? '...' : ''}`;
      }
      
      // Log helpful error message
      console.warn(`[Template Validation] ${nodeId ? `Node ${nodeId}: ` : ''}${errorMessage}`);
      
      // In strict mode, throw error
      if (process.env.VALIDATION_STRICT === 'true') {
        throw new Error(errorMessage);
      }
    }
    
    // Return original template if not resolved (backward compatibility)
    return match;
  });
}

/**
 * Execute a single workflow node
 * This is a simplified version - the full implementation would handle all node types
 */
export async function executeNode(
  node: WorkflowNode,
  input: unknown,
  nodeOutputs: LRUNodeOutputsCache,
  supabase: SupabaseClient,
  workflowId: string,
  userId?: string,
  fallbackUserId?: string // Optional: authenticated user's ID to try if workflow owner has no token
): Promise<unknown> {
  const { type, config } = node.data;
  const inputObj = extractInputObject(input);

  console.log(`Executing node: ${node.data.label} (${type})`);

  // Phase 3: Validate node configuration before execution
  const configValidation = validationMiddleware.validateConfig(type, config, node.id);
  if (!configValidation.success && configValidation.error) {
    const errorMessage = configValidation.error.message;
    console.warn(`[Validation] ${errorMessage}`);
    
    // In strict mode, return error immediately
    if (process.env.VALIDATION_STRICT === 'true') {
      return {
        ...inputObj,
        _error: `Configuration validation failed: ${errorMessage}`,
        _validationError: true,
      };
    }
    // In non-strict mode, log warning and continue (backward compatibility)
  }

  // Handle different node types
  switch (type) {
    case 'manual_trigger': {
      return {
        trigger: 'manual',
        workflow_id: workflowId,
        ...inputObj,
        executed_at: new Date().toISOString(),
      };
    }

    case 'webhook':
    case 'webhook_trigger_response': {
      return {
        trigger: 'webhook',
        method: getStringProperty(inputObj, 'method', 'POST'),
        headers: inputObj.headers || {},
        query: inputObj.query || {},
        body: inputObj.body || inputObj,
        ...inputObj,
      };
    }

    case 'set_variable': {
      const name = getStringProperty(config, 'name', '');
      const value = getStringProperty(config, 'value', '');
      // Build context with $json and json aliases
      const context = {
        ...nodeOutputs.getAll(),
        input: inputObj,
        $json: inputObj,
        json: inputObj,
      };
      const resolvedValue = resolveTemplate(value, context);
      return {
        [name]: resolvedValue,
      };
    }

    case 'set': {
      // Set node: Sets fields in output object
      // Config: { fields: '{"name": "{{input.name}}", "age": 25}' }
      const fieldsJson = getStringProperty(config, 'fields', '{}');
      const fields = safeParse<Record<string, unknown>>(fieldsJson, {}) || {};
      const resolvedFields: Record<string, unknown> = {};
      
      // Build context with input and all previous node outputs
      // Ensure $json and json point to input data (for {{$json.value1}} syntax)
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj, // Also add input properties directly
        // Add $json and json aliases for n8n-style template syntax
        $json: inputObj,
        json: inputObj,
      };
      
      // Resolve template expressions in field values
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string') {
          const resolved = resolveTemplate(value, context, node.id);
          // Try to parse as number if it looks like one
          const numValue = parseFloat(resolved);
          resolvedFields[key] = !isNaN(numValue) && resolved.trim() === String(numValue) ? numValue : resolved;
        } else {
          resolvedFields[key] = value;
        }
      }
      
      // Merge with input
      return {
        ...inputObj,
        ...resolvedFields,
      };
    }

    case 'math': {
      // Math node: Performs mathematical operations
      // Config: { operation: 'add', value1: '10', value2: '5', precision: 10 }
      const operation = getStringProperty(config, 'operation', 'add');
      const value1Str = getStringProperty(config, 'value1', '0');
      const value2Str = getStringProperty(config, 'value2', '0');
      const precision = parseInt(getStringProperty(config, 'precision', '10'), 10) || 10;
      
      // Build context with input and all previous node outputs
      // Ensure $json and json point to input data (for {{$json.value1}} syntax)
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj, // Also add input properties directly
        // Add $json and json aliases for n8n-style template syntax
        $json: inputObj,
        json: inputObj,
      };
      
      // Resolve template expressions
      const resolvedValue1 = resolveTemplate(value1Str, context);
      const resolvedValue2 = resolveTemplate(value2Str, context);
      
      // Parse values (handle arrays for min/max/sum/avg)
      const parseValue = (val: string): number | number[] => {
        if (val.includes(',')) {
          // Array of values
          return val.split(',').map(v => parseFloat(v.trim())).filter(n => !isNaN(n));
        }
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };
      
      const val1 = parseValue(resolvedValue1);
      const val2 = parseValue(resolvedValue2);
      
      let result: number;
      
      try {
        switch (operation) {
          case 'add':
            result = (Array.isArray(val1) ? val1[0] : val1) + (Array.isArray(val2) ? val2[0] : val2);
            break;
          case 'subtract':
            result = (Array.isArray(val1) ? val1[0] : val1) - (Array.isArray(val2) ? val2[0] : val2);
            break;
          case 'multiply':
            result = (Array.isArray(val1) ? val1[0] : val1) * (Array.isArray(val2) ? val2[0] : val2);
            break;
          case 'divide':
            const divisor = Array.isArray(val2) ? val2[0] : val2;
            if (divisor === 0) throw new Error('Division by zero');
            result = (Array.isArray(val1) ? val1[0] : val1) / divisor;
            break;
          case 'modulo':
            result = (Array.isArray(val1) ? val1[0] : val1) % (Array.isArray(val2) ? val2[0] : val2);
            break;
          case 'power':
            result = Math.pow(Array.isArray(val1) ? val1[0] : val1, Array.isArray(val2) ? val2[0] : val2);
            break;
          case 'sqrt':
            result = Math.sqrt(Array.isArray(val1) ? val1[0] : val1);
            break;
          case 'abs':
            result = Math.abs(Array.isArray(val1) ? val1[0] : val1);
            break;
          case 'round':
            result = Math.round(Array.isArray(val1) ? val1[0] : val1);
            break;
          case 'floor':
            result = Math.floor(Array.isArray(val1) ? val1[0] : val1);
            break;
          case 'ceil':
            result = Math.ceil(Array.isArray(val1) ? val1[0] : val1);
            break;
          case 'min':
            const arr1 = Array.isArray(val1) ? val1 : [val1 as number];
            result = Math.min(...arr1);
            break;
          case 'max':
            const arr2 = Array.isArray(val1) ? val1 : [val1 as number];
            result = Math.max(...arr2);
            break;
          case 'avg':
            const arr3 = Array.isArray(val1) ? val1 : [val1 as number];
            result = arr3.reduce((a, b) => a + b, 0) / arr3.length;
            break;
          case 'sum':
            const arr4 = Array.isArray(val1) ? val1 : [val1 as number];
            result = arr4.reduce((a, b) => a + b, 0);
            break;
          default:
            throw new Error(`Unknown math operation: ${operation}`);
        }
        
        // Apply precision
        result = parseFloat(result.toFixed(precision));
        
        return {
          ...inputObj,
          result,
          operation,
        };
      } catch (error) {
        console.error('Math node error:', error);
        return {
          ...inputObj,
          _error: error instanceof Error ? error.message : 'Math operation failed',
        };
      }
    }

    case 'log':
    case 'log_output': {
      // Log output node: Logs a message
      // Config: { message: 'Debug: {{input}}', level: 'info' }
      let message = getStringProperty(config, 'message', '');
      const level = getStringProperty(config, 'level', 'info');
      
      // Remove surrounding quotes if present (e.g., "Read {{rows}} rows" -> Read {{rows}} rows)
      if ((message.startsWith('"') && message.endsWith('"')) || 
          (message.startsWith("'") && message.endsWith("'"))) {
        message = message.slice(1, -1);
      }
      
      // Build context with input and all previous node outputs
      // Ensure $json and json point to input data (for {{$json.value1}} syntax)
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj, // Also add input properties directly (rows, data, values, etc.)
        // Add $json and json aliases for n8n-style template syntax
        $json: inputObj,
        json: inputObj,
      };
      
      // Debug: Log available fields for template resolution
      if (message.includes('{{')) {
        console.log(`[LOG_OUTPUT] Resolving template: "${message}"`);
        console.log(`[LOG_OUTPUT] Available context keys:`, Object.keys(context).slice(0, 20)); // Limit to first 20
        console.log(`[LOG_OUTPUT] Input object keys:`, Object.keys(inputObj).slice(0, 20));
        if ('rows' in inputObj) {
          console.log(`[LOG_OUTPUT] Found 'rows' field:`, inputObj.rows);
        }
      }
      
      const resolvedMessage = resolveTemplate(message, context, node.id);
      
      // Debug: Log resolved message
      if (message.includes('{{')) {
        if (resolvedMessage !== message) {
          console.log(`[LOG_OUTPUT] ✅ Resolved: "${resolvedMessage}"`);
        } else {
          console.log(`[LOG_OUTPUT] ❌ Template not resolved, original: "${message}"`);
          console.log(`[LOG_OUTPUT] Available direct keys in context:`, 
            Object.keys(context).filter(k => !['input', '$json', 'json'].includes(k)).slice(0, 10));
        }
      }
      
      // Log to console with appropriate level
      const logPrefix = `[LOG ${level.toUpperCase()}]`;
      switch (level) {
        case 'error':
          console.error(`${logPrefix} ${resolvedMessage}`);
          break;
        case 'warn':
          console.warn(`${logPrefix} ${resolvedMessage}`);
          break;
        case 'debug':
          console.debug(`${logPrefix} ${resolvedMessage}`);
          break;
        default:
          console.log(`${logPrefix} ${resolvedMessage}`);
      }
      
      return {
        ...inputObj,
        _logs: [{ 
          message: resolvedMessage, 
          level,
          timestamp: new Date().toISOString() 
        }],
      };
    }

    case 'openai_gpt':
    case 'anthropic_claude':
    case 'google_gemini': {
      const prompt = getStringProperty(config, 'prompt', '');
      const model = getStringProperty(config, 'model', 'gpt-4o');
      const provider = type === 'openai_gpt' ? 'openai' : 
                      type === 'anthropic_claude' ? 'claude' : 'gemini';
      
      // Build context with $json and json aliases
      const context = {
        ...nodeOutputs.getAll(),
        input: inputObj,
        $json: inputObj,
        json: inputObj,
      };
      const resolvedPrompt = resolveTemplate(prompt, context, node.id);
      
      const llmAdapter = new LLMAdapter();
      const response = await llmAdapter.chat(provider, [
        { role: 'user', content: resolvedPrompt }
      ], { model });

      return {
        response: response.content,
        model: response.model,
      };
    }

    case 'ai_agent': {
      // AI Agent node with port-specific inputs
      // Input structure: { chat_model: {...}, memory: {...}, tool: {...}, userInput: {...} }
      
      const systemPrompt = getStringProperty(config, 'systemPrompt', 'You are an autonomous intelligent agent inside an automation workflow.');
      const mode = getStringProperty(config, 'mode', 'chat');
      const temperature = parseFloat(getStringProperty(config, 'temperature', '0.7')) || 0.7;
      const maxTokens = parseInt(getStringProperty(config, 'maxTokens', '2000'), 10) || 2000;
      const topP = parseFloat(getStringProperty(config, 'topP', '1.0')) || 1.0;
      const frequencyPenalty = parseFloat(getStringProperty(config, 'frequencyPenalty', '0.0')) || 0.0;
      const presencePenalty = parseFloat(getStringProperty(config, 'presencePenalty', '0.0')) || 0.0;
      const timeoutLimit = parseInt(getStringProperty(config, 'timeoutLimit', '30000'), 10) || 30000;
      const retryCount = parseInt(getStringProperty(config, 'retryCount', '3'), 10) || 3;
      const outputFormat = getStringProperty(config, 'outputFormat', 'text');
      const includeReasoning = getStringProperty(config, 'includeReasoning', 'false') === 'true';
      const enableMemory = getStringProperty(config, 'enableMemory', 'true') !== 'false';
      const enableTools = getStringProperty(config, 'enableTools', 'true') !== 'false';
      
      // Extract port-specific inputs from inputObj
      const chatModelConfig = (inputObj as any)?.chat_model || {};
      const memoryData = (inputObj as any)?.memory;
      const toolData = (inputObj as any)?.tool || (inputObj as any)?.tools;
      const userInput = (inputObj as any)?.userInput || (inputObj as any)?.input || inputObj;
      
      // Determine provider and model from chat_model connection or config
      // Default to Ollama for production (llama3.1:8b)
      let provider: 'openai' | 'claude' | 'gemini' | 'ollama' = 'ollama';
      let model = 'llama3.1:8b';
      let apiKey: string | undefined;
      
      if (chatModelConfig.provider) {
        provider = chatModelConfig.provider as any;
      } else if (chatModelConfig.model) {
        provider = LLMAdapter.detectProvider(chatModelConfig.model);
      }
      
      // Default to Ollama production model if not specified
      model = chatModelConfig.model || getStringProperty(config, 'model', 'llama3.1:8b');
      
      // Only get API key if using external providers (not Ollama)
      if (provider !== 'ollama') {
      apiKey = chatModelConfig.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
      }
      
      // Build messages array
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system prompt
      const context = {
        ...nodeOutputs.getAll(),
        input: inputObj,
        $json: inputObj,
        json: inputObj,
      };
      const resolvedSystemPrompt = resolveTemplate(systemPrompt, context);
      messages.push({ role: 'system', content: resolvedSystemPrompt });
      
      // Add memory context if available
      if (enableMemory && memoryData) {
        if (Array.isArray(memoryData.messages)) {
          // Add conversation history
          memoryData.messages.forEach((msg: any) => {
            if (msg.role && msg.content) {
              messages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              });
            }
          });
        } else if (memoryData.context) {
          messages.push({
            role: 'system',
            content: `Previous context: ${JSON.stringify(memoryData.context)}`
          });
        }
      }
      
      // Add user input
      const userInputStr = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
      messages.push({ role: 'user', content: userInputStr });
      
      // Execute LLM call with timeout
      const llmAdapter = new LLMAdapter();
      let response;
      let attempts = 0;
      let lastError: Error | null = null;
      
      while (attempts <= retryCount) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeoutLimit)
          );
          
          const llmPromise = llmAdapter.chat(provider, messages, {
            model,
            temperature,
            maxTokens,
            apiKey,
          });
          
          response = await Promise.race([llmPromise, timeoutPromise]) as any;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          attempts++;
          if (attempts > retryCount) {
            throw lastError;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
      
      if (!response) {
        throw lastError || new Error('Failed to get response from LLM');
      }
      
      // Process tool calls if enabled and tools are available
      let usedTools: any[] = [];
      let finalResponse = response.content;
      
      if (enableTools && toolData) {
        // Simple tool execution - in a full implementation, this would parse tool calls from response
        // and execute them, then continue the conversation
        if (Array.isArray(toolData)) {
          usedTools = toolData;
        } else if (toolData.tools) {
          usedTools = Array.isArray(toolData.tools) ? toolData.tools : [];
        }
      }
      
      // Format output based on outputFormat
      let formattedOutput: any = {
        response_text: finalResponse,
        response_json: null,
        confidence_score: 0.8, // Default confidence
        used_tools: usedTools,
        memory_written: false,
        error_flag: false,
        error_message: null,
      };
      
      if (outputFormat === 'json') {
        try {
          formattedOutput.response_json = JSON.parse(finalResponse);
        } catch {
          // If not valid JSON, wrap it
          formattedOutput.response_json = { content: finalResponse };
        }
      } else if (outputFormat === 'keyvalue') {
        // Try to parse key-value pairs
        const lines = finalResponse.split('\n');
        const kv: Record<string, string> = {};
        lines.forEach((line: string) => {
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            kv[match[1].trim()] = match[2].trim();
          }
        });
        formattedOutput.response_json = kv;
      } else if (outputFormat === 'markdown') {
        formattedOutput.response_markdown = finalResponse;
      }
      
      if (includeReasoning) {
        formattedOutput.reasoning = {
          steps: 1,
          mode,
          provider,
          model: response.model,
        };
      }
      
      // Store in memory if enabled
      if (enableMemory && memoryData && memoryData.sessionId) {
        try {
          // In a full implementation, this would use the memory service
          formattedOutput.memory_written = true;
        } catch (error) {
          console.error('Failed to write memory:', error);
        }
      }
      
      return formattedOutput;
    }

    case 'schedule': {
      // Schedule trigger - just pass through, scheduler service handles execution
      return {
        trigger: 'schedule',
        workflow_id: workflowId,
        ...inputObj,
        executed_at: new Date().toISOString(),
      };
    }

    case 'http_request': {
      // HTTP Request node
      const method = getStringProperty(config, 'method', 'GET').toUpperCase();
      const url = getStringProperty(config, 'url', '');
      const headersJson = getStringProperty(config, 'headers', '{}');
      const bodyJson = getStringProperty(config, 'body', '');
      const timeout = parseInt(getStringProperty(config, 'timeout', '30000'), 10) || 30000;
      
      if (!url) {
        return {
          ...inputObj,
          _error: 'HTTP Request node: URL is required',
        };
      }

      // Build context for template resolution
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj,
        $json: inputObj,
        json: inputObj,
      };

      const resolvedUrl = resolveTemplate(url, context, node.id);
      let headers: Record<string, string> = {};
      let body: string | undefined;

      try {
        headers = JSON.parse(resolveTemplate(headersJson, context));
      } catch {
        // If headers is not JSON, try as string
        const resolvedHeaders = resolveTemplate(headersJson, context);
        if (resolvedHeaders) {
          try {
            headers = JSON.parse(resolvedHeaders);
          } catch {
            // Default headers
            headers = { 'Content-Type': 'application/json' };
          }
        }
      }

      if (bodyJson && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const resolvedBody = resolveTemplate(bodyJson, context);
        try {
          // Try to parse as JSON
          body = JSON.stringify(JSON.parse(resolvedBody));
        } catch {
          // Use as string
          body = resolvedBody;
        }
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(resolvedUrl, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let responseData: unknown;

        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        return {
          ...inputObj,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
          url: resolvedUrl,
        };
      } catch (error) {
        console.error('HTTP Request error:', error);
        return {
          ...inputObj,
          _error: error instanceof Error ? error.message : 'HTTP Request failed',
          url: resolvedUrl,
        };
      }
    }

    case 'javascript': {
      // JavaScript code execution node
      // SECURITY FIX: Replaced eval() with vm2 sandbox for secure execution
      const code = getStringProperty(config, 'code', '');
      
      if (!code) {
        return {
          ...inputObj,
          _error: 'JavaScript node: Code is required',
        };
      }

      // Security: Check if JavaScript execution is enabled
      if (process.env.DISABLE_JAVASCRIPT_NODE === 'true') {
        return {
          ...inputObj,
          _error: 'JavaScript node execution is disabled for security reasons',
        };
      }

      // Get timeout from config (default 5 seconds)
      const timeout = parseInt(getStringProperty(config, 'timeout', '5000'), 10) || 5000;
      
      // Enforce maximum timeout limit (30 seconds)
      const maxTimeout = 30000;
      const safeTimeout = Math.min(timeout, maxTimeout);

      try {
        // Import vm2 for secure sandboxing
        const { VM } = require('vm2');
        
        // Create vm2 sandbox with strict security settings
        const vm = new VM({
          timeout: safeTimeout, // Execution timeout in milliseconds
          sandbox: {
            // Safe context variables (read-only copies)
            input: (() => {
              try {
                return JSON.parse(JSON.stringify(inputObj)); // Deep clone
              } catch {
                return inputObj; // Fallback if cloning fails
              }
            })(),
            $json: (() => {
              try {
                return JSON.parse(JSON.stringify(inputObj)); // Deep clone
              } catch {
                return inputObj; // Fallback if cloning fails
              }
            })(),
            json: (() => {
              try {
                return JSON.parse(JSON.stringify(inputObj)); // Deep clone
              } catch {
                return inputObj; // Fallback if cloning fails
              }
            })(),
            
            // Read-only access to nodeOutputs via getter function
            // This prevents direct modification of nodeOutputs
            getNodeOutput: (nodeId: string) => {
              const output = nodeOutputs.get(nodeId);
              if (output === null || output === undefined) {
                return undefined;
              }
              try {
                // Return deep clone to prevent modification
                // Note: We keep the existing deep clone logic here even though cache has cloneOnGet option
                // This ensures consistent behavior and handles edge cases
                return JSON.parse(JSON.stringify(output));
              } catch {
                // If circular reference or non-serializable, return undefined
                return undefined;
              }
            },
            
            // Safe built-in objects
            Math: Math,
            JSON: JSON,
            Date: Date,
            Array: Array,
            Object: Object,
            String: String,
            Number: Number,
            Boolean: Boolean,
            RegExp: RegExp,
            
            // Limited console for debugging
            console: {
              log: (...args: unknown[]) => console.log('[JS Node]', ...args),
              error: (...args: unknown[]) => console.error('[JS Node]', ...args),
              warn: (...args: unknown[]) => console.warn('[JS Node]', ...args),
            },
          },
          
          // Additional security settings
          eval: false, // Disable eval() inside sandbox
          wasm: false, // Disable WebAssembly
          fixAsync: true, // Fix async/await support
        });

        // Wrap user code in IIFE to ensure proper return handling
        const wrappedCode = `
          (function() {
            ${code}
            
            // If code doesn't return anything, return input
            return typeof result !== 'undefined' ? result : input;
          })()
        `;

        // Execute code in sandbox
        const result = vm.run(wrappedCode);
        
        // Log successful execution (for monitoring)
        console.log(`[Security] JavaScript node executed successfully (timeout: ${safeTimeout}ms)`);
        
        return result;
      } catch (error) {
        // Provide detailed error information
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Log security-related errors separately
        if (errorMessage.includes('require') || 
            errorMessage.includes('process') || 
            errorMessage.includes('global') ||
            errorMessage.includes('__dirname') ||
            errorMessage.includes('__filename')) {
          console.error('[Security] JavaScript node attempted to access restricted APIs:', errorMessage);
          return {
            ...inputObj,
            _error: `Security violation: Code attempted to access restricted Node.js APIs. ${errorMessage}`,
          };
        }
        
        // Log timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('Script execution timed out')) {
          console.error('[Security] JavaScript node execution timed out');
          return {
            ...inputObj,
            _error: `Execution timeout: Code exceeded ${safeTimeout}ms execution limit`,
          };
        }
        
        // Handle other errors
        console.error('JavaScript execution error:', error);
        return {
          ...inputObj,
          _error: errorMessage,
        };
      }
    }

    case 'google_sheets': {
      // Google Sheets node - using proper helper function like Supabase version
      const operation = getStringProperty(config, 'operation', 'read');
      const spreadsheetId = getStringProperty(config, 'spreadsheetId', '');
      const sheetName = getStringProperty(config, 'sheetName', 'Sheet1');
      const range = getStringProperty(config, 'range', '');
      const outputFormat = getStringProperty(config, 'outputFormat', 'json') as 'json' | 'keyvalue' | 'text';
      const readDirection = getStringProperty(config, 'readDirection', 'rows') as 'rows' | 'columns';
      const dataJson = getStringProperty(config, 'data', '[]');

      if (!spreadsheetId) {
        throw new Error('Google Sheets node: Spreadsheet ID is required');
      }

      // Get user ID from workflow context
      if (!userId) {
        throw new Error('Google Sheets: User ID not found in workflow context. Please ensure the workflow is executed by an authenticated user.');
      }

      // Build context for template resolution
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj,
        $json: inputObj,
        json: inputObj,
      };

      // Resolve templates in config values
      const resolvedSpreadsheetId = resolveTemplate(spreadsheetId, context);
      const resolvedSheetName = sheetName ? resolveTemplate(sheetName, context) : undefined;
      const resolvedRange = range ? resolveTemplate(range, context) : undefined;

      try {
        // Get access token - try workflow owner first, then fallback user
        // Note: Credentials (GOOGLE_OAUTH_CLIENT_ID/SECRET) are only needed for token refresh
        // If tokens are already stored and valid, credentials are not required
        console.log(`[Google Sheets] Getting access token for workflow owner user_id: ${userId}, workflow_id: ${workflowId}`);
        console.log(`[Google Sheets] Fallback user_id available: ${fallbackUserId || 'none'}`);
        
        const userIdsToTry: string[] = [];
        if (userId) userIdsToTry.push(userId);
        if (fallbackUserId && fallbackUserId !== userId) userIdsToTry.push(fallbackUserId);
        
        const accessToken = userIdsToTry.length > 0 
          ? await getGoogleAccessToken(supabase, userIdsToTry) 
          : null;
        
        if (accessToken && fallbackUserId && fallbackUserId !== userId && userIdsToTry.length > 1) {
          console.log(`[Google Sheets] ✅ Successfully obtained access token (used fallback: ${userIdsToTry.indexOf(fallbackUserId) > 0})`);
        } else if (accessToken) {
          console.log(`[Google Sheets] ✅ Successfully obtained access token`);
        }
        
        if (!accessToken) {
          const ownerMessage = userId 
            ? `The workflow owner (user ${userId}) does not have a Google account connected.`
            : 'No workflow owner found.';
          const fallbackMessage = fallbackUserId && fallbackUserId !== userId
            ? `The fallback user (user ${fallbackUserId}) also does not have a Google account connected.`
            : '';
          const solutionMessage = userId && fallbackUserId && fallbackUserId !== userId
            ? 'Please ensure either: 1) The workflow owner connects their Google account in settings, or 2) You connect your Google account (if you have permission to use it for this workflow).'
            : userId
            ? 'Please ensure the workflow owner has connected their Google account in settings. If you\'re running someone else\'s workflow, you need to either: 1) Have the workflow owner connect their Google account, or 2) Transfer the workflow ownership to your account.'
            : 'Please connect a Google account in settings.';
          
          const errorMsg = `Google Sheets: OAuth token not found. ${ownerMessage} ${fallbackMessage} ${solutionMessage}`;
          console.error(`[Google Sheets] ${errorMsg}`);
          return {
            ...inputObj,
            _error: errorMsg,
          };
        }

      // Prepare data for write operations
      let writeData: unknown[][] | undefined;
      if (operation === 'write' || operation === 'append' || operation === 'update') {
        const dataConfig = config.data;
        if (dataConfig) {
          if (typeof dataConfig === 'string') {
            try {
              const resolvedData = resolveTemplate(dataConfig, context);
              writeData = JSON.parse(resolvedData);
            } catch (parseError) {
              throw new Error(`Google Sheets: Invalid JSON format for write data. Expected 2D array: [["col1", "col2"], ["val1", "val2"]]. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          } else if (Array.isArray(dataConfig)) {
            writeData = dataConfig as unknown[][];
          } else {
            throw new Error('Google Sheets: Write data must be a 2D array (array of rows). Format: [["col1", "col2"], ["val1", "val2"]]');
          }
        } else {
          // Try to extract from input
          // Support multiple formats: input.values, input.data, input.rows, or direct array
          const inputData = inputObj.values || inputObj.data || inputObj.rows || input;
          if (Array.isArray(inputData)) {
            // Check if it's already a 2D array
            if (inputData.length > 0 && Array.isArray(inputData[0])) {
              writeData = inputData as unknown[][];
            } else {
              // Convert 1D array to 2D (single row)
              writeData = [inputData as unknown[]];
            }
          } else {
            // Check if we have empty values array - this is valid for append (skip operation)
            const hasEmptyValues = inputObj.values && Array.isArray(inputObj.values) && inputObj.values.length === 0;
            
            if (hasEmptyValues && operation === 'append') {
              // For append operation, empty array is valid - just skip the operation
              console.log('[Google Sheets] Empty values array received for append operation - skipping');
              return {
                ...inputObj,
                data: {
                  updatedCells: 0,
                  range: '',
                },
                rows: 0,
                columns: 0,
                formatted: 'json',
                operation: 'append',
                sheetName: resolvedSheetName || 'Sheet1',
                spreadsheetId: resolvedSpreadsheetId,
                _skipped: true,
                _message: 'No data to append - values array is empty',
              };
            }
            
            throw new Error('Google Sheets: No data provided for write operation. Add data in node config or pass it in input (as input.values, input.data, or input.rows).');
          }
        }
      }

      // Split sheet names if comma-separated
      const sheetNames = (resolvedSheetName || 'Sheet1').split(',').map(s => s.trim()).filter(s => s);
      const results: Array<Record<string, unknown>> = [];
      let consolidatedSuccess = true;
      let consolidatedError = '';

      // Execute for each sheet
      console.log(`[Google Sheets] Executing ${operation} operation on spreadsheet: ${resolvedSpreadsheetId}, sheet: ${sheetNames.join(', ')}`);
      
      for (const sheet of sheetNames) {
        // Execute Google Sheets operation using helper function
        const result = await executeGoogleSheetsOperation({
          spreadsheetId: resolvedSpreadsheetId,
          sheetName: sheet,
          range: resolvedRange,
          operation: operation as 'read' | 'write' | 'append' | 'update',
          outputFormat: outputFormat,
          readDirection: readDirection,
          data: writeData,
          accessToken,
        });

        console.log(`[Google Sheets] Operation result:`, {
          success: result.success,
          rows: result.rows,
          columns: result.columns,
          hasData: !!result.data,
          error: result.error
        });

        if (!result.success) {
          consolidatedSuccess = false;
          consolidatedError = result.error || 'Google Sheets operation failed';
        }

        results.push({
          sheetName: sheet,
          success: result.success,
          data: result.data,
          rows: result.rows,
          columns: result.columns,
          error: result.error
        });
      }

      if (!consolidatedSuccess && sheetNames.length === 1) {
        throw new Error(consolidatedError);
      }

      // Return formatted result (consolidated if multiple sheets)
      if (sheetNames.length === 1) {
        const singleResult = results[0];
        const output = {
          ...inputObj,
          data: singleResult.data,
          rows: singleResult.rows,
          columns: singleResult.columns,
          operation,
          spreadsheetId: resolvedSpreadsheetId,
          sheetName: singleResult.sheetName,
          range: resolvedRange || 'All',
          formatted: outputFormat,
        };
        console.log(`[Google Sheets] Returning output with rows: ${singleResult.rows}, columns: ${singleResult.columns}`);
        return output;
      } else {
        // Multiple sheets result
        const output = {
          ...inputObj,
          operation,
          spreadsheetId: resolvedSpreadsheetId,
          sheets: results.reduce((acc, res) => ({ ...acc, [res.sheetName as string]: res.data }), {}),
          results: results, // Detailed results per sheet
          count: sheetNames.length,
          success: consolidatedSuccess,
          range: resolvedRange || 'All',
        };
        console.log(`[Google Sheets] Returning multi-sheet output with ${sheetNames.length} sheets`);
        return output;
      }
    }

    case 'twitter': {
      // Twitter/X API node
      const operation = getStringProperty(config, 'operation', 'tweet');
      const text = getStringProperty(config, 'text', '');
      const apiKey = getStringProperty(config, 'apiKey', '') || process.env.TWITTER_API_KEY || '';
      const apiSecret = getStringProperty(config, 'apiSecret', '') || process.env.TWITTER_API_SECRET || '';
      const accessToken = getStringProperty(config, 'accessToken', '') || process.env.TWITTER_ACCESS_TOKEN || '';
      const accessTokenSecret = getStringProperty(config, 'accessTokenSecret', '') || process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

      // Build context
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj,
        $json: inputObj,
        json: inputObj,
      };

      const resolvedText = resolveTemplate(text, context);

      if (!resolvedText && operation === 'tweet') {
        return {
          ...inputObj,
          _error: 'Twitter node: Text is required for tweet operation',
        };
      }

      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        return {
          ...inputObj,
          _error: 'Twitter node: API credentials are required. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET environment variables or configure in node settings.',
        };
      }

      // Note: Twitter API v2 requires OAuth 1.0a signing
      // This is a simplified implementation - full implementation would use oauth library
      return {
        ...inputObj,
        _error: 'Twitter node: Full Twitter API integration requires OAuth 1.0a signing. Please use a dedicated Twitter integration service or implement OAuth signing.',
        operation,
        text: resolvedText,
      };
    }

    case 'linkedin': {
      // LinkedIn API node
      const operation = getStringProperty(config, 'operation', 'post');
      const text = getStringProperty(config, 'text', '');
      
      // Build context
      const context = {
        input: inputObj,
        ...nodeOutputs.getAll(),
        ...inputObj,
        $json: inputObj,
        json: inputObj,
      };

      const resolvedText = resolveTemplate(text, context);

      if (!resolvedText && operation === 'post') {
        return {
          ...inputObj,
          _error: 'LinkedIn node: Text is required for post operation',
        };
      }

      // Get access token - try from config first, then from database (OAuth), then from env
      let accessToken = getStringProperty(config, 'accessToken', '');
      
      // If no token in config, try to get from database (OAuth tokens)
      if (!accessToken) {
        const { getLinkedInAccessToken } = await import('../shared/linkedin-oauth');
        const userIdsToTry: string[] = [];
        if (userId) userIdsToTry.push(userId);
        if (currentUserId && currentUserId !== userId) userIdsToTry.push(currentUserId);
        
        accessToken = userIdsToTry.length > 0 
          ? await getLinkedInAccessToken(supabase, userIdsToTry) || ''
          : '';
      }
      
      // Fallback to environment variable if still no token
      if (!accessToken) {
        accessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
      }

      if (!accessToken) {
        const ownerMessage = userId 
          ? `The workflow owner (user ${userId}) does not have a LinkedIn account connected.`
          : 'No workflow owner found.';
        const currentUserMessage = currentUserId && currentUserId !== userId
          ? `The current user (user ${currentUserId}) also does not have a LinkedIn account connected.`
          : '';
        const solutionMessage = userId && currentUserId && currentUserId !== userId
          ? 'Please ensure either: 1) The workflow owner connects their LinkedIn account in settings, or 2) You connect your LinkedIn account (if you have permission to use it for this workflow).'
          : userId
          ? 'Please ensure the workflow owner has connected their LinkedIn account in settings. If you\'re running someone else\'s workflow, you need to either: 1) Have the workflow owner connect their LinkedIn account, or 2) Transfer the workflow ownership to your account.'
          : 'Please connect a LinkedIn account in settings or configure an access token in node settings.';
        
        return {
          ...inputObj,
          _error: `LinkedIn: Access token not found. ${ownerMessage} ${currentUserMessage} ${solutionMessage}`,
        };
      }

      try {
        // LinkedIn API v2 endpoint
        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            author: `urn:li:person:${getStringProperty(config, 'personUrn', '')}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: resolvedText,
                },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LinkedIn API error: ${errorText}`);
        }

        const result = await response.json() as { id?: string };
        return {
          ...inputObj,
          postId: result.id,
          success: true,
        };
      } catch (error) {
        console.error('LinkedIn error:', error);
        return {
          ...inputObj,
          _error: error instanceof Error ? error.message : 'LinkedIn operation failed',
        };
      }
    }

    case 'form': {
      // Form node - this will pause execution in the main handler
      // Just return input for now, the handler will detect form nodes and pause
      return {
        ...inputObj,
        _form_node: true,
        _node_id: node.id,
      };
    }

    default: {
      // For unknown node types, return input as output
      console.warn(`Unknown node type: ${type}, returning input as output`);
      return inputObj;
    }
  }
}

/**
 * Main execute-workflow handler
 */
export default async function executeWorkflowHandler(req: Request, res: Response) {
  const supabase = getSupabaseClient();
  const { workflowId, executionId: providedExecutionId, input = {}, userId: requestUserId } = req.body;

  if (!workflowId) {
    return res.status(400).json({ error: 'workflowId is required' });
  }

  let executionId: string | undefined;
  let logs: ExecutionLog[] = [];
  let currentUserId: string | undefined;

  // Extract current user from Authorization header (if available)
  // This is optional - workflow can execute without it
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token) {
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser(token);
          if (!authError && user) {
            currentUserId = user.id;
            console.log(`[Execute Workflow] Current user: ${currentUserId}`);
          } else if (authError) {
            // Log auth error but don't fail - workflow can still execute
            console.log(`[Execute Workflow] Auth error (non-fatal): ${authError.message || 'Unknown auth error'}`);
          }
        } catch (authErr: any) {
          // Handle network/connection errors gracefully
          const errorMsg = authErr?.message || 'Unknown error';
          if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('fetch failed')) {
            console.log('[Execute Workflow] Supabase connection issue - continuing without current user ID');
          } else {
            console.log(`[Execute Workflow] Auth extraction error (non-fatal): ${errorMsg}`);
          }
        }
      }
    }
  } catch (error: any) {
    // Auth is optional - workflow can still execute without it
    const errorMsg = error?.message || 'Unknown error';
    console.log(`[Execute Workflow] Auth extraction failed (non-fatal): ${errorMsg}`);
  }

  try {
    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('Workflow fetch error:', workflowError);
      
      // Check if it's a Supabase connection error
      const errorMessage = workflowError?.message || String(workflowError || '');
      if (errorMessage.includes('ENOTFOUND') || 
          errorMessage.includes('fetch failed') || 
          errorMessage.includes('your-project-id')) {
        return res.status(500).json({ 
          error: 'Database configuration error',
          message: 'Supabase URL is not configured correctly. Please update SUPABASE_URL in your .env file with your actual Supabase project URL.',
          hint: 'Current URL appears to be a placeholder: your-project-id.supabase.co',
          details: 'The workflow cannot be fetched because the database connection is misconfigured.'
        });
      }
      
      return res.status(404).json({ 
        error: 'Workflow not found',
        message: workflowError?.message || 'The specified workflow could not be found.',
        workflowId 
      });
    }

    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    // Handle execution ID (for resuming from webhook/form triggers)
    if (providedExecutionId) {
      const { data: existingExecution, error: fetchError } = await supabase
        .from('executions')
        .select('id, started_at, input')
        .eq('id', providedExecutionId)
        .single();

      if (fetchError || !existingExecution) {
        return res.status(404).json({ error: 'Execution not found' });
      }

      executionId = existingExecution.id;

      if (!existingExecution.started_at) {
        await supabase
          .from('executions')
          .update({ started_at: new Date().toISOString() })
          .eq('id', executionId);
      }

      await supabase
        .from('executions')
        .update({ status: 'running' })
        .eq('id', executionId);
    } else {
      // Create new execution
      const startedAt = new Date().toISOString();
      const { data: newExecution, error: execError } = await supabase
        .from('executions')
        .insert({
          workflow_id: workflowId,
          user_id: workflow.user_id,
          status: 'running',
          trigger: 'manual',
          input,
          logs: [],
          started_at: startedAt,
        })
        .select()
        .single();

      if (execError || !newExecution) {
        console.error('Execution creation error:', execError);
        return res.status(500).json({ error: 'Failed to create execution' });
      }

      executionId = newExecution.id;
    }

    logs = [];
    
    // CRITICAL: State management - nodeOutputs stores outputs from each node
    // This is the key to state propagation between nodes
    // Using LRU cache to prevent unbounded memory growth
    let cacheSize = parseInt(process.env.NODE_OUTPUTS_CACHE_SIZE || '100', 10);
    if (isNaN(cacheSize) || cacheSize <= 0) {
      console.warn(`[Memory] Invalid NODE_OUTPUTS_CACHE_SIZE: ${process.env.NODE_OUTPUTS_CACHE_SIZE}, using default 100`);
      cacheSize = 100;
    }
    
    const nodeOutputs = new LRUNodeOutputsCache(cacheSize, false); // cloneOnGet=false for template resolution
    nodeOutputs.set('trigger', input, true); // Mark trigger as persistent
    
    // Warn if cache size may be too small for workflow
    if (nodes.length > 0 && cacheSize < nodes.length * 0.5) {
      console.warn(
        `[Memory] Cache size (${cacheSize}) may be too small for workflow with ${nodes.length} nodes. ` +
        `Consider increasing NODE_OUTPUTS_CACHE_SIZE to at least ${Math.ceil(nodes.length * 0.8)}`
      );
    }
    
    const ifElseResults: Record<string, boolean> = {};
    const switchResults: Record<string, string | null> = {};
    
    // Track memory usage for monitoring
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    // Build execution order (topological sort)
    const allNodes = topologicalSort(nodes, edges);
    const executionOrder = allNodes.filter(n => n.data.type !== 'error_trigger');
    const errorTriggerNodes = allNodes.filter(n => n.data.type === 'error_trigger');

    // If resuming from form submission, find where we left off
    let startFromIndex = 0;
    if (providedExecutionId) {
      const { data: execData } = await supabase
        .from('executions')
        .select('waiting_for_node_id, logs, input')
        .eq('id', executionId)
        .single();
      
      if (execData?.waiting_for_node_id) {
        // Find the form node index and start from the next node
        const formNodeIndex = executionOrder.findIndex(n => n.id === execData.waiting_for_node_id);
        if (formNodeIndex >= 0) {
          startFromIndex = formNodeIndex + 1;
          console.log(`[Resume] Resuming from node index ${startFromIndex} (after form node ${execData.waiting_for_node_id})`);
          
          // Restore node outputs from logs if available
          if (execData.logs && Array.isArray(execData.logs)) {
            const restoredOutputs: Record<string, unknown> = {};
            execData.logs.forEach((log: any) => {
              if (log.output !== undefined && log.nodeId) {
                restoredOutputs[log.nodeId] = log.output;
              }
            });
            // Use warm() to restore all entries at once with same timestamp
            if (Object.keys(restoredOutputs).length > 0) {
              nodeOutputs.warm(restoredOutputs);
              console.log(`[Resume] Restored ${Object.keys(restoredOutputs).length} node outputs from logs`);
            }
          }
          
          // Set form node output to the form submission data (from execution input)
          if (execData.input && formNodeIndex >= 0) {
            const formNode = executionOrder[formNodeIndex];
            nodeOutputs.set(formNode.id, execData.input);
            console.log(`[Resume] Set form node output from submission data`);
          }
        }
      }
    }

    console.log('Execution order:', executionOrder.map(n => n.data.label));
    if (startFromIndex > 0) {
      console.log(`[Resume] Skipping first ${startFromIndex} nodes, starting from: ${executionOrder[startFromIndex]?.data.label}`);
    }

    let finalOutput: unknown = input;
    let hasError = false;
    let errorMessage = '';

    // Execute nodes in order (starting from resume point if applicable)
    for (let i = startFromIndex; i < executionOrder.length; i++) {
      const node = executionOrder[i];
      const log: ExecutionLog = {
        nodeId: node.id,
        nodeName: node.data.label,
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      try {
        // Determine node input based on incoming edges
        let nodeInput: unknown = input;

        const inputEdges = edges.filter(e => e.target === node.id);
        
        // Special handling for AI Agent node with port-specific connections
        if (node.data.type === 'ai_agent' && inputEdges.length > 0) {
          const portInputs: Record<string, unknown> = {};
          
          inputEdges.forEach(edge => {
            const sourceOutput = nodeOutputs.get(edge.source);
            if (sourceOutput === undefined) {
              const nodeExists = nodes.some(n => n.id === edge.source);
              if (nodeExists) {
                console.warn(
                  `[Memory] Output for node "${edge.source}" not found (may have been evicted). ` +
                  `Cache size: ${nodeOutputs.getStats().maxSize}, current size: ${nodeOutputs.getStats().size}`
                );
              }
              return; // Skip this source
            }
            
            const targetHandle = edge.targetHandle || 'default';
            
            // Map port handles to input structure
            if (targetHandle === 'chat_model') {
              portInputs.chat_model = sourceOutput;
            } else if (targetHandle === 'memory') {
              portInputs.memory = sourceOutput;
            } else if (targetHandle === 'tool') {
              portInputs.tool = sourceOutput;
            } else {
              // Default port or no handle specified - treat as user input
              portInputs.userInput = sourceOutput;
            }
          });
          
          // Merge with any existing input
          nodeInput = { ...extractInputObject(input), ...portInputs };
        } else if (inputEdges.length > 0) {
          // Standard node input handling
          const sourceNodeId = inputEdges[0].source;
          const sourceOutput = nodeOutputs.get(sourceNodeId);
          
          if (sourceOutput !== undefined) {
            nodeInput = sourceOutput;
          } else {
            // Cache miss - check if node exists
            const nodeExists = nodes.some(n => n.id === sourceNodeId);
            if (nodeExists) {
              throw new Error(
                `Output for node "${sourceNodeId}" not found (may have been evicted from cache). ` +
                `Consider increasing NODE_OUTPUTS_CACHE_SIZE (current: ${nodeOutputs.getStats().maxSize})`
              );
            }
            // Node doesn't exist - use input as fallback
            nodeInput = input;
          }
          
          if (inputEdges.length > 1) {
            // Multiple inputs - merge them
            nodeInput = inputEdges.reduce((acc, edge) => {
              const sourceOutput = nodeOutputs.get(edge.source);
              if (sourceOutput !== undefined) {
                return { ...extractInputObject(acc), ...extractInputObject(sourceOutput) };
              } else {
                // Cache miss - log warning but continue
                console.warn(`[Workflow ${workflowId}] [Node ${node.id}] Output for node "${edge.source}" not found, skipping merge`);
              }
              return acc;
            }, nodeInput);
          }
        }

        log.input = nodeInput;
        
        // Update execution logs when node starts running so frontend can see it immediately
        if (executionId) {
          try {
            const runningLogs = [...logs, log];
            await supabase
              .from('executions')
              .update({ logs: runningLogs })
              .eq('id', executionId);
          } catch (logUpdateError) {
            // Log error but don't break execution
            console.error(`[Workflow ${workflowId}] [Node ${node.id}] Failed to update execution logs:`, logUpdateError);
          }
        }

        // Handle form nodes - pause execution and wait for form submission
        // Check BEFORE executing the node to avoid unnecessary work
        if (node.data.type === 'form') {
          console.log(`[Form Node] Detected form node: ${node.id}, pausing execution...`);
          console.log(`[Form Node] Execution ID: ${executionId}, Workflow ID: ${workflowId}`);
          
          // Update execution status to "waiting" for form submission
          if (executionId) {
            const updateData = {
              status: 'waiting',
              trigger: 'form',
              waiting_for_node_id: node.id,
            };
            
            console.log(`[Form Node] Updating execution with:`, updateData);
            
            const { data: updatedExecution, error: updateError } = await supabase
              .from('executions')
              .update(updateData)
              .eq('id', executionId)
              .select()
              .single();
            
            if (updateError) {
              console.error('[Form Node] Failed to update execution status:', updateError);
              console.error('[Form Node] Update data attempted:', updateData);
              console.error('[Form Node] Execution ID:', executionId);
              
              // Check if it's a column/type error
              const errorMessage = updateError.message || String(updateError);
              const isColumnError = errorMessage.includes('column') || 
                                   errorMessage.includes('does not exist') ||
                                   errorMessage.includes('invalid input value');
              
              if (isColumnError) {
                return res.status(500).json({
                  error: 'Database migration required',
                  message: 'The database schema needs to be updated for form triggers to work.',
                  details: errorMessage,
                  migrationHint: 'Please run the form_trigger_setup.sql migration in your Supabase SQL Editor. This adds the "waiting" status, "form" trigger, and "waiting_for_node_id" column.',
                });
              }
              
              return res.status(500).json({
                error: 'Failed to pause workflow',
                message: 'Could not set execution to waiting status',
                details: errorMessage,
                code: updateError.code,
              });
            } else {
              console.log(`[Form Node] Execution ${executionId} successfully set to waiting for form node ${node.id}`);
              console.log(`[Form Node] Updated execution:`, {
                id: updatedExecution?.id,
                status: updatedExecution?.status,
                trigger: updatedExecution?.trigger,
                waiting_for_node_id: updatedExecution?.waiting_for_node_id,
              });
            }
          } else {
            console.error('[Form Node] No execution ID available!');
            return res.status(500).json({
              error: 'Execution error',
              message: 'No execution ID found. Cannot pause workflow.',
            });
          }
          
          // Return early - workflow is paused waiting for form submission
          log.status = 'success'; // Use 'success' instead of 'waiting' to match type
          log.finishedAt = new Date().toISOString();
          logs.push(log);
          
          // Update execution with logs before returning
          if (executionId) {
            const { error: logError } = await supabase
              .from('executions')
              .update({ logs })
              .eq('id', executionId);
            
            if (logError) {
              console.error('[Form Node] Failed to update execution logs:', logError);
            }
          }
          
          // Generate form URL - use frontend URL format, not backend API URL
          // The frontend will handle routing to the form page
          const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || process.env.PUBLIC_BASE_URL?.replace(':3001', ':8080') || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080');
          if (!frontendUrl && process.env.NODE_ENV === 'production') {
            console.error('[Form Node] FRONTEND_URL environment variable is required in production');
            return res.status(500).json({
              error: 'Configuration error',
              message: 'Frontend URL is not configured. Please set FRONTEND_URL environment variable.',
            });
          }
          const formUrl = `${frontendUrl}/form/${workflowId}/${node.id}`;
          if (process.env.NODE_ENV !== 'production') {
          console.log(`[Form Node] Returning form URL: ${formUrl}`);
          }
          
          return res.status(200).json({
            success: true,
            status: 'waiting',
            executionId,
            message: 'Workflow paused waiting for form submission',
            formNodeId: node.id,
            formUrl,
          });
        }

        // Execute node
        // Pass requestUserId as fallback in case workflow owner doesn't have Google connected
        // but the user executing the workflow does
        if (node.data.type === 'google_sheets') {
          console.log(`[execute-workflow] Google Sheets node detected - workflow owner: ${workflow.user_id}, request user: ${requestUserId || 'none'}`);
        }
        const output = await executeNode(
          node,
          nodeInput,
          nodeOutputs,
          supabase,
          workflowId,
          workflow.user_id,
          requestUserId // Fallback: authenticated user's ID from request (extracted from req.body above)
        );

        // CRITICAL: Store output in nodeOutputs for state propagation
        // This allows subsequent nodes to access this node's output
        nodeOutputs.set(node.id, output);
        finalOutput = output;

        // Handle If/Else and Switch nodes
        if (node.data.type === 'if_else' && typeof output === 'object' && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (typeof outputObj.condition === 'boolean') {
            ifElseResults[node.id] = outputObj.condition;
          }
        }

        if (node.data.type === 'switch' && typeof output === 'object' && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (outputObj.matchedCase !== undefined) {
            switchResults[node.id] = outputObj.matchedCase as string | null;
          }
        }

        log.output = output;
        log.status = 'success';
        log.finishedAt = new Date().toISOString();
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        console.error(`[Workflow ${workflowId}] [Node ${node.id}] [${node.data.label}] ERROR:`, errorObj.message, errorObj);
        
        log.status = 'failed';
        log.error = errorObj.message;
        log.finishedAt = new Date().toISOString();
        hasError = true;
        errorMessage = log.error;

        // Execute error trigger nodes if any
        if (errorTriggerNodes.length > 0) {
          for (const errorTriggerNode of errorTriggerNodes) {
            try {
              const errorInput = {
                failed_node: node.data.label || node.id,
                error_message: errorObj.message,
                error_type: errorObj.constructor.name,
                workflow_id: workflowId,
                execution_id: executionId,
              };

              await executeNode(
                errorTriggerNode,
                errorInput,
                nodeOutputs,
                supabase,
                workflowId,
                workflow.user_id
              );
            } catch (errorTriggerError) {
              console.error(`[Workflow ${workflowId}] [Error Trigger ${errorTriggerNode.id}] Execution failed:`, errorTriggerError);
            }
          }
        }

        // Break execution on error (unless error handler continues)
        break;
      }

      logs.push(log);
      
      // Update execution logs incrementally so frontend can see progress in real-time
      if (executionId) {
        try {
          await supabase
            .from('executions')
            .update({ logs })
            .eq('id', executionId);
        } catch (logUpdateError) {
          // Log error but don't break execution - logs will be saved at the end anyway
          console.error('Failed to update execution logs incrementally:', logUpdateError);
        }
      }
    }

    // Log cache statistics and memory usage before cleanup
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const memoryDelta = endMemory - startMemory;
    
    if (process.env.ENABLE_MEMORY_LOGGING === 'true') {
      const stats = nodeOutputs.getStats();
      console.log(`[Memory] Workflow ${workflowId} cache stats:`, {
        size: stats.size,
        maxSize: stats.maxSize,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
        evictions: stats.evictions,
      });
      console.log(`[Memory] Workflow ${workflowId} memory: ${startMemory.toFixed(2)}MB → ${endMemory.toFixed(2)}MB (Δ${memoryDelta.toFixed(2)}MB)`);
    }
    
    // Clear cache when workflow completes (success or failure)
    // This prevents memory leaks from long-running processes
    nodeOutputs.clear();

    // Update execution with final status
    const finishedAt = new Date().toISOString();
    
    // Calculate duration if started_at exists
    let durationMs: number | null = null;
    if (executionId) {
      const { data: execData } = await supabase
        .from('executions')
        .select('started_at')
        .eq('id', executionId)
        .single();
      
      if (execData?.started_at) {
        const startedAt = new Date(execData.started_at).getTime();
        const finishedAtTime = new Date(finishedAt).getTime();
        durationMs = finishedAtTime - startedAt;
      }
    }
    
    const finalStatus = hasError ? 'failed' : 'success';
    await supabase
      .from('executions')
      .update({
        status: finalStatus,
        output: finalOutput,
        logs,
        finished_at: finishedAt,
        duration_ms: durationMs,
        ...(hasError && { error: errorMessage }),
      })
      .eq('id', executionId);

    // Return response
    if (hasError) {
      return res.status(500).json({
        error: errorMessage,
        executionId,
        logs,
        output: finalOutput,
      });
    }

    return res.json({
      status: 'success',
      success: true,
      executionId,
      output: finalOutput,
      logs,
      durationMs,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error(`[Workflow ${req.body.workflowId || 'unknown'}] Execute workflow error:`, errorObj.message, errorObj);
    const errorMessage = errorObj.message;
    
    return res.status(500).json({
      error: errorMessage,
      executionId: executionId ?? 'unknown',
      logs: logs ?? [],
    });
  }
}
