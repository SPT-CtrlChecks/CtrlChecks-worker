// Execute Workflow API Route
// Migrated from Supabase Edge Function with correct state propagation

import { Request, Response } from 'express';
import { getSupabaseClient } from '../core/database/supabase-compat';
import { config } from '../core/config';
import { LLMAdapter } from '../shared/llm-adapter';
import { HuggingFaceRouterClient } from '../shared/huggingface-client';

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
 */
function resolveTemplate(template: string, context: Record<string, unknown>): string {
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
  
  // Support multiple template patterns: {{key}}, {{key.field}}, {{$json.path}}, {{input.path}}
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    
    // Handle $json syntax: {{$json.value1}} or {{$json.path.to.value}}
    if (trimmedPath.startsWith('$json.')) {
      const jsonPath = trimmedPath.substring(6); // Remove '$json.' prefix
      const value = getNestedValue(jsonData, jsonPath);
      if (value !== null && value !== undefined) {
        return String(value);
      }
      return match; // Path not found, return original
    }
    
    // Handle json syntax: {{json.value1}}
    if (trimmedPath.startsWith('json.')) {
      const jsonPath = trimmedPath.substring(5); // Remove 'json.' prefix
      const value = getNestedValue(jsonData, jsonPath);
      if (value !== null && value !== undefined) {
        return String(value);
      }
      return match; // Path not found, return original
    }
    
    // Try direct access first
    if (flattenedContext[trimmedPath] !== undefined) {
      const value = flattenedContext[trimmedPath];
      return value !== null && value !== undefined ? String(value) : match;
    }
    
    // Try dot notation (e.g., input.name)
    const parts = trimmedPath.split('.');
    let current: unknown = enrichedContext;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return match; // Path not found
      }
    }
    
    return current !== null && current !== undefined ? String(current) : match;
  });
}

/**
 * Execute a single workflow node
 * This is a simplified version - the full implementation would handle all node types
 */
export async function executeNode(
  node: WorkflowNode,
  input: unknown,
  nodeOutputs: Record<string, unknown>,
  supabase: any,
  workflowId: string,
  userId?: string
): Promise<unknown> {
  const { type, config } = node.data;
  const inputObj = extractInputObject(input);

  console.log(`Executing node: ${node.data.label} (${type})`);

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
        ...nodeOutputs,
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
      try {
        const fields = JSON.parse(fieldsJson);
        const resolvedFields: Record<string, unknown> = {};
        
        // Build context with input and all previous node outputs
        // Ensure $json and json point to input data (for {{$json.value1}} syntax)
        const context = {
          input: inputObj,
          ...nodeOutputs,
          ...inputObj, // Also add input properties directly
          // Add $json and json aliases for n8n-style template syntax
          $json: inputObj,
          json: inputObj,
        };
        
        // Resolve template expressions in field values
        for (const [key, value] of Object.entries(fields)) {
          if (typeof value === 'string') {
            const resolved = resolveTemplate(value, context);
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
      } catch (error) {
        console.error('Set node: Invalid fields JSON:', error);
        return {
          ...inputObj,
          _error: 'Invalid fields JSON in Set node',
        };
      }
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
        ...nodeOutputs,
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
      const message = getStringProperty(config, 'message', '');
      const level = getStringProperty(config, 'level', 'info');
      
      // Build context with input and all previous node outputs
      // Ensure $json and json point to input data (for {{$json.value1}} syntax)
      const context = {
        input: inputObj,
        ...nodeOutputs,
        ...inputObj, // Also add input properties directly
        // Add $json and json aliases for n8n-style template syntax
        $json: inputObj,
        json: inputObj,
      };
      
      const resolvedMessage = resolveTemplate(message, context);
      
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
        ...nodeOutputs,
        input: inputObj,
        $json: inputObj,
        json: inputObj,
      };
      const resolvedPrompt = resolveTemplate(prompt, context);
      
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
      let provider: 'openai' | 'claude' | 'gemini' | 'ollama' = 'openai';
      let model = 'gpt-4o';
      let apiKey: string | undefined;
      
      if (chatModelConfig.provider) {
        provider = chatModelConfig.provider as any;
      } else if (chatModelConfig.model) {
        provider = LLMAdapter.detectProvider(chatModelConfig.model);
      }
      
      model = chatModelConfig.model || getStringProperty(config, 'model', 'gpt-4o');
      apiKey = chatModelConfig.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
      
      // Build messages array
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system prompt
      const context = {
        ...nodeOutputs,
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
  const { workflowId, executionId: providedExecutionId, input = {} } = req.body;

  if (!workflowId) {
    return res.status(400).json({ error: 'workflowId is required' });
  }

  let executionId: string | undefined;
  let logs: ExecutionLog[] = [];

  try {
    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('Workflow fetch error:', workflowError);
      return res.status(404).json({ error: 'Workflow not found' });
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
    const nodeOutputs: Record<string, unknown> = { trigger: input };
    const ifElseResults: Record<string, boolean> = {};
    const switchResults: Record<string, string | null> = {};

    // Build execution order (topological sort)
    const allNodes = topologicalSort(nodes, edges);
    const executionOrder = allNodes.filter(n => n.data.type !== 'error_trigger');
    const errorTriggerNodes = allNodes.filter(n => n.data.type === 'error_trigger');

    console.log('Execution order:', executionOrder.map(n => n.data.label));

    let finalOutput: unknown = input;
    let hasError = false;
    let errorMessage = '';

    // Execute nodes in order
    for (const node of executionOrder) {
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
            const sourceOutput = nodeOutputs[edge.source];
            if (sourceOutput !== undefined) {
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
            }
          });
          
          // Merge with any existing input
          nodeInput = { ...extractInputObject(input), ...portInputs };
        } else if (inputEdges.length > 0) {
          // Standard node input handling
          const sourceNodeId = inputEdges[0].source;
          const sourceOutput = nodeOutputs[sourceNodeId];
          
          if (sourceOutput !== undefined) {
            nodeInput = sourceOutput;
          } else if (inputEdges.length > 1) {
            // Multiple inputs - merge them
            nodeInput = inputEdges.reduce((acc, edge) => {
              const sourceOutput = nodeOutputs[edge.source];
              if (sourceOutput !== undefined) {
                return { ...extractInputObject(acc), ...extractInputObject(sourceOutput) };
              }
              return acc;
            }, {});
          }
        }

        log.input = nodeInput;

        // Execute node
        const output = await executeNode(
          node,
          nodeInput,
          nodeOutputs,
          supabase,
          workflowId,
          workflow.user_id
        );

        // CRITICAL: Store output in nodeOutputs for state propagation
        // This allows subsequent nodes to access this node's output
        nodeOutputs[node.id] = output;
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
        console.error(`Node ${node.data.label} ERROR:`, error);
        
        log.status = 'failed';
        const errorObj = error instanceof Error ? error : new Error(String(error));
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
              console.error('Error trigger execution failed:', errorTriggerError);
            }
          }
        }

        // Break execution on error (unless error handler continues)
        break;
      }

      logs.push(log);
    }

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
    console.error('Execute workflow error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return res.status(500).json({
      error: errorMessage,
      executionId: executionId ?? 'unknown',
      logs: logs ?? [],
    });
  }
}
