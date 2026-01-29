// Agentic Workflow Builder
// Prompt-to-workflow generation with iterative improvement

import { randomUUID } from 'crypto';
import { ollamaOrchestrator } from './ollama-orchestrator';
import {
  WorkflowNode,
  WorkflowEdge,
  Workflow,
  Requirements,
  GenerationProgress,
  OutputDefinition,
  WorkflowGenerationStructure,
  WorkflowStepDefinition,
  WorkflowImprovement,
  ImprovementAnalysis,
  Change,
} from '../../core/types/ai-types';
import { TypeValidator } from '../../core/validation/type-validator';

export class AgenticWorkflowBuilder {
  private nodeLibrary: Map<string, any> = new Map();

  constructor() {
    this.initializeNodeLibrary();
  }

  /**
   * Initialize comprehensive node library for Autonomous Workflow Agent v2.5
   * Matches all available nodes from the frontend nodeTypes.ts
   */
  private initializeNodeLibrary(): void {
    const nodeTypes = [
      // ============================================
      // TRIGGER NODES
      // ============================================
      { type: 'chat_trigger', category: 'triggers', label: 'Chat Trigger', description: 'Trigger workflow from chat/AI interactions' },
      { type: 'error_trigger', category: 'triggers', label: 'Error Trigger', description: 'Trigger workflow when errors occur' },
      { type: 'interval', category: 'triggers', label: 'Interval', description: 'Trigger workflow at fixed intervals (seconds, minutes, hours)' },
      { type: 'manual_trigger', category: 'triggers', label: 'Manual Trigger', description: 'Start workflow manually' },
      { type: 'schedule', category: 'triggers', label: 'Schedule Trigger', description: 'Execute workflow at specific times using cron schedule' },
      { type: 'webhook', category: 'triggers', label: 'Webhook', description: 'Trigger workflow from HTTP requests (GET, POST, PUT)' },
      { type: 'workflow_trigger', category: 'triggers', label: 'Workflow Trigger', description: 'Trigger workflow from another workflow' },
      { type: 'form', category: 'triggers', label: 'Form', description: 'Trigger workflow from form submissions' },
      
      // ============================================
      // CORE LOGIC NODES
      // ============================================
      { type: 'error_handler', category: 'logic', label: 'Error Handler', description: 'Handle errors with retry logic and fallback values' },
      { type: 'filter', category: 'logic', label: 'Filter', description: 'Filter array items by condition' },
      { type: 'if_else', category: 'logic', label: 'If/Else', description: 'Conditional branching based on true/false condition' },
      { type: 'loop', category: 'logic', label: 'Loop', description: 'Iterate over array items with max iterations limit' },
      { type: 'merge', category: 'logic', label: 'Merge', description: 'Merge multiple inputs (objects, arrays, or wait for all)' },
      { type: 'noop', category: 'logic', label: 'NoOp', description: 'Pass through node - no operation' },
      { type: 'split_in_batches', category: 'logic', label: 'Split In Batches', description: 'Split array into batches for processing' },
      { type: 'stop_and_error', category: 'logic', label: 'Stop And Error', description: 'Stop workflow execution with error message' },
      { type: 'switch', category: 'logic', label: 'Switch', description: 'Multi-path conditional logic based on value matching' },
      { type: 'wait', category: 'logic', label: 'Wait', description: 'Wait for specified time or condition before continuing' },
      
      // ============================================
      // DATA MANIPULATION NODES
      // ============================================
      { type: 'javascript', category: 'data', label: 'JavaScript', description: 'Execute JavaScript code with access to input data' },
      { type: 'set_variable', category: 'data', label: 'Set Variable', description: 'Set workflow variables for use in other nodes' },
      { type: 'json_parser', category: 'data', label: 'JSON Parser', description: 'Parse JSON strings into objects' },
      { type: 'text_formatter', category: 'data', label: 'Text Formatter', description: 'Format text strings with templates' },
      { type: 'date_time', category: 'data', label: 'Date/Time', description: 'Date and time operations (format, parse, calculate)' },
      { type: 'math', category: 'data', label: 'Math', description: 'Mathematical operations and calculations' },
      { type: 'html', category: 'data', label: 'HTML', description: 'Parse and manipulate HTML content' },
      { type: 'xml', category: 'data', label: 'XML', description: 'Parse and manipulate XML content' },
      { type: 'csv', category: 'data', label: 'CSV', description: 'Parse and generate CSV data' },
      
      // ============================================
      // AI & ML NODES
      // ============================================
      { type: 'ai_agent', category: 'ai', label: 'AI Agent', description: 'Autonomous AI agent with memory, tools, and reasoning capabilities' },
      { type: 'openai_gpt', category: 'ai', label: 'OpenAI GPT', description: 'OpenAI GPT chat completion (GPT-4, GPT-3.5)' },
      { type: 'anthropic_claude', category: 'ai', label: 'Claude', description: 'Anthropic Claude chat completion' },
      { type: 'google_gemini', category: 'ai', label: 'Gemini', description: 'Google Gemini chat completion' },
      { type: 'ollama', category: 'ai', label: 'Ollama', description: 'Local Ollama models for chat completion' },
      { type: 'text_summarizer', category: 'ai', label: 'Text Summarizer', description: 'Summarize long text into shorter versions' },
      { type: 'sentiment_analyzer', category: 'ai', label: 'Sentiment Analyzer', description: 'Analyze sentiment and emotions in text' },
      { type: 'chat_model', category: 'ai', label: 'Chat Model', description: 'Chat model connector for AI Agent node' },
      { type: 'memory', category: 'ai', label: 'Memory', description: 'Memory storage for AI Agent context' },
      { type: 'tool', category: 'ai', label: 'Tool', description: 'Tool connector for AI Agent to use external functions' },
      
      // ============================================
      // HTTP & API NODES
      // ============================================
      { type: 'http_request', category: 'http_api', label: 'HTTP Request', description: 'Make HTTP requests (GET, POST, PUT, DELETE, PATCH)' },
      { type: 'http_post', category: 'http_api', label: 'HTTP POST', description: 'Send POST requests with JSON data' },
      { type: 'respond_to_webhook', category: 'http_api', label: 'Respond to Webhook', description: 'Send response back to webhook caller' },
      
      // ============================================
      // GOOGLE SERVICES NODES
      // ============================================
      { type: 'google_sheets', category: 'google', label: 'Google Sheets', description: 'Read/write Google Sheets data' },
      { type: 'google_drive', category: 'google', label: 'Google Drive', description: 'Google Drive file operations (upload, download, list)' },
      { type: 'google_gmail', category: 'google', label: 'Gmail', description: 'Send/receive emails via Gmail API' },
      { type: 'google_calendar', category: 'google', label: 'Google Calendar', description: 'Create, read, update calendar events' },
      
      // ============================================
      // OUTPUT & COMMUNICATION NODES
      // ============================================
      { type: 'slack_message', category: 'output', label: 'Slack', description: 'Send messages to Slack channels or users' },
      { type: 'log_output', category: 'output', label: 'Log Output', description: 'Log data to console or file' },
      { type: 'discord', category: 'output', label: 'Discord', description: 'Send messages to Discord channels' },
      { type: 'email', category: 'output', label: 'Email', description: 'Send emails via SMTP' },
      
      // ============================================
      // DATABASE NODES
      // ============================================
      { type: 'database_read', category: 'database', label: 'Database Read', description: 'Read data from database (SQL queries)' },
      { type: 'database_write', category: 'database', label: 'Database Write', description: 'Write data to database (INSERT, UPDATE, DELETE)' },
      { type: 'supabase', category: 'database', label: 'Supabase', description: 'Supabase database operations (CRUD)' },
      
      // ============================================
      // ADDITIONAL NODES
      // ============================================
      { type: 'webhook_response', category: 'http_api', label: 'Webhook Response', description: 'Send response to webhook request' },
    ];

    nodeTypes.forEach(node => {
      this.nodeLibrary.set(node.type, node);
    });
  }

  /**
   * Get node library description for AI agent
   * Returns formatted string describing all available nodes for workflow generation
   */
  getNodeLibraryDescription(): string {
    const categories: Record<string, Array<{ type: string; label: string; description: string }>> = {};
    
    // Group nodes by category
    this.nodeLibrary.forEach((node) => {
      if (!categories[node.category]) {
        categories[node.category] = [];
      }
      categories[node.category].push({
        type: node.type,
        label: node.label,
        description: node.description,
      });
    });

    // Build description string
    let description = 'Available Node Library for Autonomous Workflow Agent v2.5:\n\n';
    
    const categoryOrder = [
      'triggers', 'logic', 'data', 'ai', 'http_api', 
      'google', 'output', 'database'
    ];
    
    categoryOrder.forEach(category => {
      if (categories[category]) {
        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
        description += `${categoryLabel} Nodes:\n`;
        categories[category].forEach(node => {
          description += `  - ${node.type} (${node.label}): ${node.description}\n`;
        });
        description += '\n';
      }
    });

    return description;
  }

  /**
   * Simplified 7-Step Workflow Generation Process
   * 1. User raw prompt (input)
   * 2. Questions for confirming (handled externally)
   * 3. System prompt in 20-30 words (what you understood)
   * 4. Workflow requirements (URL, API, etc.)
   * 5. Workflow building
   * 6. Validating
   * 7. Outputs
   */
  async generateFromPrompt(
    userPrompt: string,
    constraints?: any,
    onProgress?: (progress: { step: number; stepName: string; progress: number; details?: any }) => void
  ): Promise<{
    workflow: Workflow;
    documentation: string;
    suggestions: any[];
    estimatedComplexity: string;
    systemPrompt?: string;
    requirements?: any;
  }> {
    console.log(`🤖 Generating workflow from prompt: "${userPrompt}"`);
    
    // Step 3: Generate system prompt (20-30 words understanding)
    onProgress?.({ step: 3, stepName: 'Understanding', progress: 20, details: { message: 'Generating system prompt...' } });
    const systemPrompt = await this.generateSystemPrompt(userPrompt, constraints);
    
    // Step 4: Extract workflow requirements (URLs, APIs, credentials, etc.)
    onProgress?.({ step: 4, stepName: 'Requirements Extraction', progress: 40, details: { message: 'Extracting requirements...' } });
    const requirements = await this.extractWorkflowRequirements(userPrompt, systemPrompt, constraints);
    
    // Step 5: Build workflow
    onProgress?.({ step: 5, stepName: 'Building', progress: 50, details: { message: 'Building workflow structure...' } });
    const structure = await this.generateStructure(requirements);
    
    onProgress?.({ step: 5, stepName: 'Building', progress: 60, details: { message: 'Selecting nodes...' } });
    const nodes = await this.selectNodes(structure, requirements);
    
    onProgress?.({ step: 5, stepName: 'Building', progress: 70, details: { message: 'Configuring nodes...' } });
    const configuredNodes = await this.configureNodes(nodes, requirements, constraints);
    
    onProgress?.({ step: 5, stepName: 'Building', progress: 80, details: { message: 'Creating connections...' } });
    const connections = await this.createConnections(configuredNodes, requirements);
    
    // Step 6: Validate workflow and auto-fix errors
    onProgress?.({ step: 6, stepName: 'Validating', progress: 90, details: { message: 'Validating workflow...' } });
    const typeValidation = TypeValidator.validateWorkflow({
      nodes: configuredNodes,
      edges: connections,
    });
    
    if (!typeValidation.isValid) {
      console.warn('⚠️  Type validation warnings:', typeValidation.errors);
    }
    
    let finalNodes = configuredNodes;
    let finalEdges = connections;
    
    const validation = await this.validateWorkflow({
      nodes: finalNodes,
      edges: finalEdges,
    });
    
    // Auto-fix errors to ensure 100% working workflow
    if (!validation.valid || validation.errors.length > 0) {
      onProgress?.({ step: 6, stepName: 'Healing', progress: 92, details: { message: 'Fixing errors automatically...' } });
      const fixed = await this.autoFixWorkflow(finalNodes, finalEdges, requirements, constraints);
      finalNodes = fixed.nodes;
      finalEdges = fixed.edges;
      
      // Re-validate after fixing
      const revalidation = await this.validateWorkflow({
        nodes: finalNodes,
        edges: finalEdges,
      });
      
      if (!revalidation.valid && revalidation.errors.length > 0) {
        console.warn('⚠️  Some errors remain after auto-fix:', revalidation.errors);
        // Try one more time with more aggressive fixes
        const secondFix = await this.autoFixWorkflow(finalNodes, finalEdges, requirements, constraints, true);
        finalNodes = secondFix.nodes;
        finalEdges = secondFix.edges;
      }
    }
    
    // Step 7: Generate outputs and documentation
    onProgress?.({ step: 7, stepName: 'Finalizing', progress: 95, details: { message: 'Generating documentation...' } });
    const documentation = await this.generateDocumentation(
      finalNodes,
      finalEdges,
      requirements
    );
    
    onProgress?.({ step: 7, stepName: 'Complete', progress: 100, details: { message: 'Workflow ready!' } });
    
    return {
      workflow: {
        nodes: finalNodes,
        edges: finalEdges,
        metadata: {
          generatedFrom: userPrompt,
          systemPrompt,
          requirements,
          validation,
          timestamp: new Date().toISOString(),
        },
      },
      documentation,
      suggestions: await this.provideEnhancementSuggestions(
        finalNodes,
        finalEdges,
        requirements
      ),
      estimatedComplexity: this.calculateComplexity(configuredNodes, connections),
      systemPrompt,
      requirements,
    };
  }

  async streamGeneration(
    prompt: string,
    onProgress: (progress: GenerationProgress) => void
  ): Promise<void> {
    onProgress({ step: 'analyzing', progress: 10 });
    const requirements = await this.analyzeRequirements(prompt);
    
    onProgress({ step: 'structuring', progress: 30 });
    const structure = await this.generateStructure(requirements);
    
    onProgress({ step: 'selecting_nodes', progress: 50 });
    const nodes = await this.selectNodes(structure, requirements);
    
    onProgress({ step: 'configuring', progress: 70 });
    const configuredNodes = await this.configureNodes(nodes, requirements);
    
    onProgress({ step: 'connecting', progress: 85 });
    const connections = await this.createConnections(configuredNodes, requirements);
    
    onProgress({ step: 'validating', progress: 95 });
    const validation = await this.validateWorkflow({
      nodes: configuredNodes,
      edges: connections,
    });
    
    onProgress({ step: 'complete', progress: 100, details: { validation } });
  }

  /**
   * Step 3: Generate system prompt in 20-30 words summarizing what was understood
   */
  async generateSystemPrompt(
    userPrompt: string,
    constraints?: any
  ): Promise<string> {
    if (!userPrompt || !userPrompt.trim()) {
      return 'Build an automated workflow based on user requirements.';
    }

    const prompt = `Based on this workflow request, create a concise 20-30 word system prompt that summarizes what you understood:

User Request: "${userPrompt}"
${constraints ? `Constraints: ${JSON.stringify(constraints)}` : ''}

Generate a clear, concise system prompt (20-30 words) that captures the core intent and goal. Return only the prompt text, no JSON, no explanations.`;

    try {
      const result = await ollamaOrchestrator.processRequest('workflow-generation', {
        prompt,
        temperature: 0.2,
        maxTokens: 100,
      });
      
      let systemPrompt = typeof result === 'string' ? result.trim() : JSON.stringify(result);
      
      // Clean up if wrapped in quotes or code blocks
      systemPrompt = systemPrompt.replace(/^["']|["']$/g, '').replace(/```[\w]*\n?|\n?```/g, '').trim();
      
      // Remove any trailing punctuation that might break the prompt
      systemPrompt = systemPrompt.replace(/[.!?]+$/, '');
      
      // Ensure it's 20-30 words
      const words = systemPrompt.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 30) {
        systemPrompt = words.slice(0, 30).join(' ');
      } else if (words.length < 20) {
        // If too short, add context
        const additionalWords = 'Build an automated workflow to accomplish this task.'.split(/\s+/);
        const needed = 20 - words.length;
        systemPrompt = `${systemPrompt} ${additionalWords.slice(0, needed).join(' ')}`;
      }
      
      // Final validation - ensure it's not empty
      if (!systemPrompt || systemPrompt.trim().length === 0) {
        return `Build an automated workflow to: ${userPrompt.substring(0, 100)}`;
      }
      
      return systemPrompt.trim();
    } catch (error) {
      console.error('Error generating system prompt:', error);
      // Fallback - create a reasonable prompt from the user input
      const fallback = userPrompt.length > 100 
        ? `Build an automated workflow to: ${userPrompt.substring(0, 100)}...`
        : `Build an automated workflow to: ${userPrompt}`;
      return fallback;
    }
  }

  /**
   * Step 4: Extract workflow requirements (URLs, APIs, credentials, etc.)
   */
  async extractWorkflowRequirements(
    userPrompt: string,
    systemPrompt: string,
    constraints?: any
  ): Promise<Requirements> {
    const nodeLibraryInfo = this.getNodeLibraryDescription();
    
    const extractionPrompt = `You are an Autonomous Workflow Agent v2.5. Extract workflow requirements from this request.

${nodeLibraryInfo}

User Request: "${userPrompt}"
System Understanding: "${systemPrompt}"
${constraints ? `Constraints: ${JSON.stringify(constraints)}` : ''}

Based on the available node library above, extract and return JSON with:
{
  "primaryGoal": "...",
  "keySteps": ["step1", "step2", ...],
  "inputs": ["input1", "input2", ...],
  "outputs": ["output1", "output2", ...],
  "constraints": ["constraint1", ...],
  "complexity": "simple|medium|complex",
  "urls": ["url1", "url2", ...] (if any URLs mentioned),
  "apis": ["api1", "api2", ...] (if any APIs mentioned),
  "credentials": ["credential1", "credential2", ...] (if any credentials needed),
  "schedules": ["schedule1", ...] (if any schedules mentioned),
  "platforms": ["platform1", ...] (if any platforms like Slack, Google Sheets, etc.)
}

Use only nodes from the library above.`;
    
    try {
      const result = await ollamaOrchestrator.processRequest('workflow-generation', {
        prompt: extractionPrompt,
        temperature: 0.3,
      });
      
      let parsed;
      try {
        const jsonText = typeof result === 'string' ? result : JSON.stringify(result);
        let cleanJson = jsonText.trim();
        
        // Extract JSON from code blocks if present
        if (cleanJson.includes('```json')) {
          cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
        } else if (cleanJson.includes('```')) {
          cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
        }
        
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn('Failed to parse requirements, using fallback');
        parsed = {};
      }
      
      return {
        primaryGoal: parsed.primaryGoal || userPrompt,
        keySteps: parsed.keySteps || [],
        inputs: parsed.inputs || [],
        outputs: parsed.outputs || [],
        constraints: parsed.constraints || [],
        complexity: parsed.complexity || 'medium',
        urls: parsed.urls || [],
        apis: parsed.apis || [],
        credentials: parsed.credentials || [],
        schedules: parsed.schedules || [],
        platforms: parsed.platforms || [],
      };
    } catch (error) {
      console.error('Error extracting requirements:', error);
      // Fallback
      // Fallback - try to infer basic requirements from prompt
      const inferredUrls: string[] = [];
      const inferredPlatforms: string[] = [];
      const inferredSchedules: string[] = [];
      
      const promptLower = userPrompt.toLowerCase();
      
      // Infer platforms
      if (promptLower.includes('slack')) inferredPlatforms.push('Slack');
      if (promptLower.includes('google') || promptLower.includes('gmail') || promptLower.includes('sheets')) inferredPlatforms.push('Google');
      if (promptLower.includes('instagram')) inferredPlatforms.push('Instagram');
      if (promptLower.includes('twitter') || promptLower.includes('x.com')) inferredPlatforms.push('Twitter');
      if (promptLower.includes('discord')) inferredPlatforms.push('Discord');
      
      // Infer schedules
      if (promptLower.includes('daily') || promptLower.includes('every day')) inferredSchedules.push('Daily');
      if (promptLower.includes('weekly')) inferredSchedules.push('Weekly');
      if (promptLower.includes('hourly')) inferredSchedules.push('Hourly');
      if (promptLower.match(/\d+:\d+/)) {
        const timeMatch = userPrompt.match(/(\d+:\d+)/);
        if (timeMatch) inferredSchedules.push(`At ${timeMatch[1]}`);
      }
      
      return {
        primaryGoal: userPrompt,
        keySteps: [],
        inputs: [],
        outputs: [],
        constraints: [],
        complexity: 'medium',
        urls: inferredUrls,
        apis: [],
        credentials: [],
        schedules: inferredSchedules,
        platforms: inferredPlatforms,
      };
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async analyzeRequirements(
    prompt: string,
    constraints?: any
  ): Promise<Requirements> {
    const requirements = await this.extractWorkflowRequirements(prompt, '', constraints);
    return {
      primaryGoal: requirements.primaryGoal,
      keySteps: requirements.keySteps,
      inputs: requirements.inputs,
      outputs: requirements.outputs,
      constraints: requirements.constraints,
      complexity: requirements.complexity,
    };
  }

  private async generateStructure(requirements: Requirements): Promise<WorkflowGenerationStructure> {
    const nodeLibraryInfo = this.getNodeLibraryDescription();
    
    // Generate a logical structure for the workflow using AI
    const structurePrompt = `You are an Autonomous Workflow Agent v2.5. Generate workflow structure.

${nodeLibraryInfo}

Requirements:
${JSON.stringify(requirements, null, 2)}

Based on the requirements and available nodes, determine:
1. Trigger type (use only trigger nodes from library)
2. Workflow steps (use appropriate nodes from library)
3. Output nodes (use only output nodes from library)

Return JSON:
{
  "trigger": "node_type_from_library",
  "steps": [
    {"id": "step1", "description": "...", "type": "node_type_from_library"},
    ...
  ],
  "outputs": [
    {"name": "output1", "type": "string|number|boolean|object|array", "description": "...", "required": true}
  ]
}`;

    try {
      const result = await ollamaOrchestrator.processRequest('workflow-generation', {
        prompt: structurePrompt,
        temperature: 0.3,
      });

      let parsed;
      try {
        const jsonText = typeof result === 'string' ? result : JSON.stringify(result);
        let cleanJson = jsonText.trim();
        
        if (cleanJson.includes('```json')) {
          cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
        } else if (cleanJson.includes('```')) {
          cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
        }
        
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn('Failed to parse AI-generated structure, using fallback');
        parsed = null;
      }

      if (parsed && parsed.trigger && this.nodeLibrary.has(parsed.trigger)) {
        const structure: WorkflowGenerationStructure = {
          trigger: parsed.trigger,
          steps: parsed.steps || [],
          outputs: parsed.outputs || [],
        };
        return structure;
      }
    } catch (error) {
      console.warn('Error generating structure with AI, using fallback logic:', error);
    }

    // Fallback: Generate structure using simple logic
    const structure: WorkflowGenerationStructure = {
      trigger: null,
      steps: [],
      outputs: [],
    };
    
    // Determine trigger type based on requirements
    if (requirements.schedules && requirements.schedules.length > 0) {
      structure.trigger = 'schedule';
    } else if (requirements.urls && requirements.urls.some(url => url.includes('webhook'))) {
      structure.trigger = 'webhook';
    } else if (requirements.platforms && requirements.platforms.some(p => p.toLowerCase().includes('form'))) {
      structure.trigger = 'form';
    } else {
      structure.trigger = 'manual_trigger';
    }
    
    // Map key steps to workflow steps
    requirements.keySteps.forEach((step, index) => {
      const stepDefinition: WorkflowStepDefinition = {
        id: `step_${index + 1}`,
        description: step,
        type: this.inferStepType(step),
      };
      structure.steps.push(stepDefinition);
    });
    
    // Map outputs - FIXED: Now correctly typed as OutputDefinition[]
    requirements.outputs.forEach((output, index) => {
      const outputDefinition: OutputDefinition = {
        name: this.generateOutputName(output),
        type: this.inferOutputType(output),
        description: output,
        required: true,
        format: this.inferFormat(output),
      };
      structure.outputs.push(outputDefinition);
    });
    
    // Validate the structure before returning
    const validation = TypeValidator.validateStructure({
      inputs: [],
      outputs: structure.outputs,
      steps: structure.steps,
    });
    
    if (!validation.isValid) {
      console.warn('⚠️  Structure validation warnings:', validation.errors);
      if (validation.errors.length > 0) {
        throw new Error(`Invalid workflow structure: ${validation.errors.join(', ')}`);
      }
    }
    
    return structure;
  }

  /**
   * Infer node type from step description using node library
   */
  private inferStepType(step: string): string {
    const stepLower = step.toLowerCase();
    
    // Check node library for best match
    interface MatchResult {
      type: string;
      score: number;
    }
    let bestMatch: MatchResult | null = null;
    
    for (const [type, node] of this.nodeLibrary.entries()) {
      const nodeLabelLower = node.label.toLowerCase();
      const nodeDescLower = node.description.toLowerCase();
      let score = 0;
      
      // Check if step keywords match node label or description
      const stepWords = stepLower.split(/\s+/);
      stepWords.forEach(word => {
        if (word.length > 2) { // Ignore short words
          if (nodeLabelLower.includes(word)) score += 3;
          if (nodeDescLower.includes(word)) score += 2;
          if (type.includes(word)) score += 4;
        }
      });
      
      // Specific keyword matching
      if (stepLower.includes('http') || stepLower.includes('api') || stepLower.includes('request')) {
        if (type === 'http_request' || type === 'http_post') score += 10;
      }
      if (stepLower.includes('ai') || stepLower.includes('chat') || stepLower.includes('generate')) {
        if (type.includes('ai') || type.includes('gpt') || type.includes('claude') || type.includes('gemini')) score += 10;
      }
      if (stepLower.includes('sheet') || stepLower.includes('spreadsheet')) {
        if (type === 'google_sheets') score += 10;
      }
      if (stepLower.includes('code') || stepLower.includes('process') || stepLower.includes('transform')) {
        if (type === 'javascript') score += 10;
      }
      if (stepLower.includes('if') || stepLower.includes('condition') || stepLower.includes('check')) {
        if (type === 'if_else' || type === 'switch') score += 10;
      }
      if (stepLower.includes('loop') || stepLower.includes('iterate') || stepLower.includes('each')) {
        if (type === 'loop') score += 10;
      }
      if (stepLower.includes('filter') || stepLower.includes('select')) {
        if (type === 'filter') score += 10;
      }
      if (stepLower.includes('slack') || stepLower.includes('message')) {
        if (type === 'slack_message') score += 10;
      }
      if (stepLower.includes('email') || stepLower.includes('gmail')) {
        if (type === 'google_gmail' || type === 'email') score += 10;
      }
      if (stepLower.includes('database') || stepLower.includes('db') || stepLower.includes('query')) {
        if (type.includes('database') || type === 'supabase') score += 10;
      }
      
      if (score > 0) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { type, score };
        }
      }
    }
    
    return bestMatch ? bestMatch.type : 'set_variable';
  }

  private inferOutputType(output: string): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' {
    const outputLower = output.toLowerCase();
    
    // Determine the data type, not the node type
    if (outputLower.includes('json') || outputLower.includes('object')) return 'object';
    if (outputLower.includes('array') || outputLower.includes('list')) return 'array';
    if (outputLower.includes('number') || outputLower.includes('count') || outputLower.includes('total')) return 'number';
    if (outputLower.includes('boolean') || outputLower.includes('flag')) return 'boolean';
    if (outputLower.includes('file') || outputLower.includes('attachment')) return 'file';
    
    return 'string';
  }

  private inferFormat(output: string): string | undefined {
    const outputLower = output.toLowerCase();
    
    if (outputLower.includes('json')) return 'json';
    if (outputLower.includes('csv')) return 'csv';
    if (outputLower.includes('xml')) return 'xml';
    if (outputLower.includes('html')) return 'html';
    if (outputLower.includes('markdown') || outputLower.includes('md')) return 'markdown';
    
    return undefined;
  }

  private generateOutputName(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }

  private async selectNodes(
    structure: WorkflowGenerationStructure,
    requirements: Requirements
  ): Promise<WorkflowNode[]> {
    const nodes: WorkflowNode[] = [];
    let xPosition = 100;
    const ySpacing = 150;
    
    // Add trigger node with unique UUID
    // Triggers use their type name as label (already short)
    const triggerNode: WorkflowNode = {
      id: randomUUID(),
      type: structure.trigger || 'manual_trigger',
      position: { x: xPosition, y: 100 },
      data: {
        type: structure.trigger || 'manual_trigger',
        label: this.getNodeLabel(structure.trigger || 'manual_trigger'),
        category: 'triggers',
        config: {},
      },
    };
    nodes.push(triggerNode);
    xPosition += 300;
    
    // Add step nodes with unique UUIDs
    structure.steps.forEach((step: WorkflowStepDefinition, index: number) => {
      // Extract short label from description (max 3-4 words)
      let shortLabel = this.getNodeLabel(step.type);
      if (step.description) {
        // Clean description first
        let cleanDesc = step.description
          .replace(/^[-*•]\s*/, '') // Remove bullet points
          .replace(/\*\*/g, '') // Remove markdown bold
          .replace(/\[.*?\]/g, '') // Remove markdown links
          .trim();
        
        const words = cleanDesc.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length <= 4) {
          shortLabel = words.join(' ');
        } else {
          // Extract key action - try to get verb + noun (first 2-3 words)
          // Skip common words like "the", "a", "an", "to", "for", "with"
          const skipWords = ['the', 'a', 'an', 'to', 'for', 'with', 'from', 'and', 'or', 'in', 'on', 'at'];
          const meaningfulWords = words.filter(w => !skipWords.includes(w.toLowerCase()));
          
          if (meaningfulWords.length >= 2) {
            shortLabel = meaningfulWords.slice(0, 3).join(' ');
          } else {
            shortLabel = words.slice(0, 3).join(' ');
          }
          
          // Limit length
          if (shortLabel.length > 35) {
            shortLabel = shortLabel.substring(0, 32) + '...';
          }
        }
        // Clean up label - remove trailing punctuation
        shortLabel = shortLabel.replace(/[.,;:!?]+$/, '').trim();
        
        // Capitalize first letter
        if (shortLabel.length > 0) {
          shortLabel = shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1);
        }
      }
      
      const node: WorkflowNode = {
        id: randomUUID(),
        type: step.type,
        position: { x: xPosition, y: 100 + (index * ySpacing) },
        data: {
          type: step.type,
          label: shortLabel,
          category: this.getNodeCategory(step.type),
          config: {},
        },
      };
      nodes.push(node);
      xPosition += 300;
    });
    
    // Add output nodes with unique UUIDs
    structure.outputs.forEach((output: OutputDefinition, index: number) => {
      // Map output type to node type for output nodes
      const nodeType = this.mapOutputTypeToNodeType(output);
      
      // Extract short label from description (max 3-4 words)
      let shortLabel = this.getNodeLabel(nodeType);
      if (output.description) {
        // Clean description first
        let cleanDesc = output.description
          .replace(/^[-*•]\s*/, '') // Remove bullet points
          .replace(/\*\*/g, '') // Remove markdown bold
          .replace(/\[.*?\]/g, '') // Remove markdown links
          .trim();
        
        const words = cleanDesc.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length <= 4) {
          shortLabel = words.join(' ');
        } else {
          // Extract key action - try to get verb + noun
          const skipWords = ['the', 'a', 'an', 'to', 'for', 'with', 'from', 'and', 'or', 'in', 'on', 'at'];
          const meaningfulWords = words.filter(w => !skipWords.includes(w.toLowerCase()));
          
          if (meaningfulWords.length >= 2) {
            shortLabel = meaningfulWords.slice(0, 3).join(' ');
          } else {
            shortLabel = words.slice(0, 3).join(' ');
          }
          
          // Limit length
          if (shortLabel.length > 35) {
            shortLabel = shortLabel.substring(0, 32) + '...';
          }
        }
        // Clean up label
        shortLabel = shortLabel.replace(/[.,;:!?]+$/, '').trim();
        
        // Capitalize first letter
        if (shortLabel.length > 0) {
          shortLabel = shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1);
        }
      }
      
      const node: WorkflowNode = {
        id: randomUUID(),
        type: nodeType,
        position: { x: xPosition, y: 100 + (index * ySpacing) },
        data: {
          type: nodeType,
          label: shortLabel,
          category: 'output',
          config: {},
        },
      };
      nodes.push(node);
    });
    
    return nodes;
  }

  private async configureNodes(
    nodes: WorkflowNode[],
    requirements: Requirements,
    constraints?: any
  ): Promise<WorkflowNode[]> {
    // Configure each node based on requirements and user-provided config values
    const configValues = constraints || {};
    
    // Configure each node with intelligent field filling
    const configuredNodes = await Promise.all(nodes.map(async (node) => {
      const config = await this.generateNodeConfig(node, requirements, configValues);
      return {
        ...node,
        data: {
          ...node.data,
          config,
        },
      };
    }));
    
    return configuredNodes;
  }

  private async generateNodeConfig(
    node: WorkflowNode, 
    requirements: Requirements,
    configValues: Record<string, any> = {}
  ): Promise<Record<string, unknown>> {
    const config: Record<string, unknown> = {};
    
    // Extract values from configValues (user-provided credentials/URLs)
    const getConfigValue = (key: string, fallback?: any): any => {
      // Try exact match first
      if (configValues[key] !== undefined && configValues[key] !== null && configValues[key] !== '') {
        return configValues[key];
      }
      // Try case-insensitive match
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(configValues)) {
        if (k.toLowerCase() === lowerKey && v !== undefined && v !== null && v !== '') {
          return v;
        }
      }
      return fallback;
    };

    // Helper to extract from requirements arrays
    const getFromRequirements = (type: 'urls' | 'apis' | 'credentials' | 'schedules' | 'platforms', index: number = 0): string | undefined => {
      const arr = requirements[type] || [];
      return arr[index] || undefined;
    };

    // Use AI to intelligently configure nodes based on type and requirements
    try {
      switch (node.type) {
        case 'http_request':
        case 'http_post':
          config.method = node.type === 'http_post' ? 'POST' : 'GET';
          config.url = getConfigValue('url') || getConfigValue('api_url') || getFromRequirements('urls', 0) || 'https://api.example.com/endpoint';
          config.headers = getConfigValue('headers') || {};
          if (getConfigValue('api_key') || getFromRequirements('credentials', 0)) {
            const apiKey = getConfigValue('api_key') || getFromRequirements('credentials', 0);
            config.headers = { ...(config.headers as Record<string, string>), 'Authorization': `Bearer ${apiKey}` };
          }
          break;
        
        case 'schedule':
          const schedule = getFromRequirements('schedules', 0) || getConfigValue('schedule');
          if (schedule) {
            // Try to parse schedule string into cron format
            config.cronExpression = this.parseScheduleToCron(schedule);
          } else {
            config.cronExpression = '0 9 * * *'; // Default: 9 AM daily
          }
          break;
        
        case 'interval':
          config.interval = getConfigValue('interval') || 3600; // Default 1 hour
          config.unit = getConfigValue('unit') || 'seconds';
          break;
        
        case 'if_else':
          config.condition = getConfigValue('condition') || '{{ $json.property }} === "value"';
          break;
        
        case 'set_variable':
          config.variables = getConfigValue('variables') || [];
          break;
        
        case 'openai_gpt':
          config.model = getConfigValue('model') || 'gpt-3.5-turbo';
          config.prompt = getConfigValue('prompt') || requirements.primaryGoal || '';
          config.apiKey = getConfigValue('openai_api_key') || getConfigValue('api_key') || getFromRequirements('credentials', 0) || '';
          config.temperature = getConfigValue('temperature') || 0.7;
          config.maxTokens = getConfigValue('maxTokens') || 2000;
          break;
        
        case 'anthropic_claude':
          config.model = getConfigValue('model') || 'claude-3-sonnet-20240229';
          config.prompt = getConfigValue('prompt') || requirements.primaryGoal || '';
          config.apiKey = getConfigValue('claude_api_key') || getConfigValue('api_key') || getFromRequirements('credentials', 0) || '';
          config.temperature = getConfigValue('temperature') || 0.7;
          config.maxTokens = getConfigValue('maxTokens') || 2000;
          break;
        
        case 'google_gemini':
          config.model = getConfigValue('model') || 'gemini-pro';
          config.prompt = getConfigValue('prompt') || requirements.primaryGoal || '';
          config.apiKey = getConfigValue('gemini_api_key') || getConfigValue('api_key') || getFromRequirements('credentials', 0) || '';
          config.temperature = getConfigValue('temperature') || 0.7;
          config.maxTokens = getConfigValue('maxTokens') || 2000;
          break;
        
        case 'google_sheets':
          config.operation = getConfigValue('operation') || 'read';
          // Extract spreadsheet ID from URL if provided
          const sheetUrl = getConfigValue('google_sheet_url') || getConfigValue('url') || getFromRequirements('urls', 0) || '';
          if (sheetUrl) {
            const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (sheetIdMatch) {
              config.spreadsheetId = sheetIdMatch[1];
            } else {
              config.spreadsheetId = sheetUrl; // Assume it's already an ID
            }
          } else {
            config.spreadsheetId = getConfigValue('spreadsheetId') || getConfigValue('spreadsheet_id') || '';
          }
          config.sheetName = getConfigValue('sheetName') || getConfigValue('sheet_name') || 'Sheet1';
          config.range = getConfigValue('range') || '';
          config.outputFormat = getConfigValue('outputFormat') || 'json';
          break;
        
        case 'slack_message':
          config.webhookUrl = getConfigValue('slack_webhook_url') || getConfigValue('webhook_url') || getFromRequirements('urls', 0) || '';
          config.channel = getConfigValue('slack_channel') || getConfigValue('channel') || '#general';
          config.message = getConfigValue('message') || requirements.primaryGoal || '';
          config.token = getConfigValue('slack_token') || getConfigValue('token') || getFromRequirements('credentials', 0) || '';
          break;
        
        case 'discord':
          config.webhookUrl = getConfigValue('discord_webhook_url') || getConfigValue('webhook_url') || getFromRequirements('urls', 0) || '';
          config.message = getConfigValue('message') || requirements.primaryGoal || '';
          break;
        
        case 'email':
          config.smtpHost = getConfigValue('smtp_host') || 'smtp.gmail.com';
          config.smtpPort = getConfigValue('smtp_port') || 587;
          config.username = getConfigValue('email') || getConfigValue('username') || '';
          config.password = getConfigValue('email_password') || getConfigValue('password') || getFromRequirements('credentials', 0) || '';
          config.to = getConfigValue('to') || '';
          config.subject = getConfigValue('subject') || 'Workflow Notification';
          config.body = getConfigValue('body') || requirements.primaryGoal || '';
          break;
        
        case 'google_gmail':
          config.operation = getConfigValue('operation') || 'send';
          config.to = getConfigValue('to') || '';
          config.subject = getConfigValue('subject') || 'Workflow Notification';
          config.body = getConfigValue('body') || requirements.primaryGoal || '';
          break;
        
        case 'webhook':
          config.method = getConfigValue('method') || 'POST';
          config.path = getConfigValue('path') || '/webhook';
          break;
        
        case 'loop':
          config.maxIterations = getConfigValue('maxIterations') || 100;
          break;
        
        case 'wait':
          config.duration = getConfigValue('duration') || 1000;
          config.unit = getConfigValue('unit') || 'milliseconds';
          break;
        
        case 'filter':
          config.condition = getConfigValue('condition') || '{{ $json }}';
          break;
        
        case 'javascript':
          config.code = getConfigValue('code') || 'return $input;';
          break;
        
        case 'text_formatter':
          config.template = getConfigValue('template') || '{{ $json }}';
          break;
        
        case 'ai_agent':
          config.systemPrompt = getConfigValue('systemPrompt') || requirements.primaryGoal || '';
          config.mode = getConfigValue('mode') || 'chat';
          config.temperature = getConfigValue('temperature') || 0.7;
          config.maxTokens = getConfigValue('maxTokens') || 2000;
          break;
        
        default:
          // For unknown node types, try to fill common fields
          if (requirements.primaryGoal) {
            config.prompt = requirements.primaryGoal;
          }
          break;
      }
    } catch (error) {
      console.error(`Error configuring node ${node.type}:`, error);
      // Fallback: at least set basic config
      if (requirements.primaryGoal) {
        config.prompt = requirements.primaryGoal;
      }
    }
    
    return config;
  }

  /**
   * Parse schedule string to cron expression
   */
  private parseScheduleToCron(schedule: string): string {
    const lower = schedule.toLowerCase();
    
    // Daily patterns
    if (lower.includes('daily') || lower.includes('every day')) {
      const timeMatch = schedule.match(/(\d+):(\d+)/);
      if (timeMatch) {
        return `${timeMatch[2]} ${timeMatch[1]} * * *`; // minute hour * * *
      }
      return '0 9 * * *'; // Default 9 AM
    }
    
    // Hourly
    if (lower.includes('hourly') || lower.includes('every hour')) {
      return '0 * * * *';
    }
    
    // Weekly
    if (lower.includes('weekly') || lower.includes('every week')) {
      return '0 9 * * 0'; // Sunday 9 AM
    }
    
    // Monthly
    if (lower.includes('monthly') || lower.includes('every month')) {
      return '0 9 1 * *'; // 1st of month at 9 AM
    }
    
    // Try to parse cron-like expressions
    if (/^[\d\s\*\/,-]+$/.test(schedule.trim())) {
      return schedule.trim();
    }
    
    // Default: daily at 9 AM
    return '0 9 * * *';
  }

  private async createConnections(
    nodes: WorkflowNode[],
    requirements: Requirements
  ): Promise<WorkflowEdge[]> {
    const edges: WorkflowEdge[] = [];
    
    // Connect nodes sequentially with unique UUIDs
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: randomUUID(),
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'default',
      });
    }
    
    return edges;
  }

  private async validateWorkflow(workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
      return { valid: false, errors, warnings };
    }
    
    // Check for trigger - CRITICAL: workflow must have a trigger
    const triggerNodes = workflow.nodes.filter(n => 
      ['manual_trigger', 'webhook', 'schedule', 'interval', 'chat_trigger', 'workflow_trigger', 'form', 'error_trigger'].includes(n.type)
    );
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    } else if (triggerNodes.length > 1) {
      warnings.push('Workflow has multiple trigger nodes - ensure only one is active');
    }
    
    // Validate node configurations
    workflow.nodes.forEach(node => {
      const config = node.data?.config || {};
      
      // Validate specific node types have required fields
      switch (node.type) {
        case 'schedule':
          if (!config.cronExpression || typeof config.cronExpression !== 'string') {
            errors.push(`Schedule node ${node.id} missing cronExpression`);
          }
          break;
        
        case 'interval':
          if (config.interval === undefined || config.interval === null) {
            errors.push(`Interval node ${node.id} missing interval value`);
          }
          break;
        
        case 'http_request':
        case 'http_post':
          if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
            warnings.push(`HTTP node ${node.id} has empty URL - may need configuration`);
          }
          break;
        
        case 'google_sheets':
          if (!config.spreadsheetId || typeof config.spreadsheetId !== 'string' || config.spreadsheetId.trim() === '') {
            warnings.push(`Google Sheets node ${node.id} missing spreadsheetId - may need configuration`);
          }
          break;
        
        case 'slack_message':
          if (!config.webhookUrl && !config.token) {
            warnings.push(`Slack node ${node.id} missing webhookUrl or token - may need configuration`);
          }
          break;
        
        case 'openai_gpt':
        case 'anthropic_claude':
        case 'google_gemini':
          if (!config.prompt || typeof config.prompt !== 'string' || config.prompt.trim() === '') {
            warnings.push(`AI node ${node.id} has empty prompt - may need configuration`);
          }
          break;
        
        case 'if_else':
          if (!config.condition || typeof config.condition !== 'string' || config.condition.trim() === '') {
            errors.push(`If/Else node ${node.id} missing condition`);
          }
          break;
        
        case 'set_variable':
          if (!Array.isArray(config.variables)) {
            warnings.push(`Set Variable node ${node.id} variables should be an array`);
          }
          break;
      }
    });
    
    // Check connections - ensure all edges reference valid nodes
    workflow.edges.forEach(edge => {
      const sourceExists = workflow.nodes.some(n => n.id === edge.source);
      const targetExists = workflow.nodes.some(n => n.id === edge.target);
      
      if (!sourceExists) {
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!targetExists) {
        errors.push(`Edge references non-existent target node: ${edge.target}`);
      }
    });
    
    // Check for orphaned nodes (nodes with no connections)
    const connectedNodeIds = new Set<string>();
    workflow.edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    const orphanedNodes = workflow.nodes.filter(node => {
      // Trigger nodes don't need incoming connections
      if (['manual_trigger', 'webhook', 'schedule', 'interval', 'chat_trigger', 'workflow_trigger', 'form', 'error_trigger'].includes(node.type)) {
        return false;
      }
      return !connectedNodeIds.has(node.id);
    });
    
    if (orphanedNodes.length > 0) {
      warnings.push(`Found ${orphanedNodes.length} orphaned node(s) that may not be connected properly`);
    }
    
    // Ensure workflow has at least one output or end node
    const hasOutput = workflow.nodes.some(n => 
      ['log_output', 'slack_message', 'email', 'discord', 'respond_to_webhook', 'webhook_response'].includes(n.type)
    );
    if (!hasOutput && workflow.nodes.length > 1) {
      warnings.push('Workflow may benefit from an output node to see results');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Auto-fix workflow errors to ensure 100% working workflow
   */
  private async autoFixWorkflow(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    requirements: Requirements,
    constraints?: any,
    aggressive: boolean = false
  ): Promise<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }> {
    let fixedNodes = [...nodes];
    let fixedEdges = [...edges];

    // Fix 1: Ensure workflow has at least one trigger
    const triggerNodes = fixedNodes.filter(n => 
      ['manual_trigger', 'webhook', 'schedule', 'interval', 'chat_trigger', 'workflow_trigger', 'form', 'error_trigger'].includes(n.type)
    );
    
    if (triggerNodes.length === 0) {
      // Add a manual trigger at the beginning
      const manualTrigger: WorkflowNode = {
        id: randomUUID(),
        type: 'manual_trigger',
        position: { x: 250, y: 100 },
        data: {
          type: 'manual_trigger',
          label: 'Start',
          category: 'triggers',
          config: {},
        },
      };
      fixedNodes.unshift(manualTrigger);
      
      // Connect trigger to first non-trigger node
      const firstNonTrigger = fixedNodes.find(n => !['manual_trigger', 'webhook', 'schedule', 'interval', 'chat_trigger', 'workflow_trigger', 'form', 'error_trigger'].includes(n.type));
      if (firstNonTrigger) {
        fixedEdges.unshift({
          id: randomUUID(),
          source: manualTrigger.id,
          target: firstNonTrigger.id,
          type: 'default',
        });
      }
    }

    // Fix 2: Fix orphaned nodes by connecting them
    const connectedNodeIds = new Set<string>();
    fixedEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    fixedNodes.forEach(node => {
      // Skip trigger nodes (they don't need incoming connections)
      if (['manual_trigger', 'webhook', 'schedule', 'interval', 'chat_trigger', 'workflow_trigger', 'form', 'error_trigger'].includes(node.type)) {
        return;
      }

      // If node has no incoming connections, connect it to the previous node
      if (!connectedNodeIds.has(node.id)) {
        const nodeIndex = fixedNodes.findIndex(n => n.id === node.id);
        if (nodeIndex > 0) {
          const previousNode = fixedNodes[nodeIndex - 1];
          fixedEdges.push({
            id: randomUUID(),
            source: previousNode.id,
            target: node.id,
            type: 'default',
          });
          connectedNodeIds.add(node.id);
        }
      }
    });

    // Fix 3: Fix invalid node configurations
    fixedNodes = fixedNodes.map(node => {
      const config = node.data?.config || {};
      const fixedConfig = { ...config };

      switch (node.type) {
        case 'schedule':
          if (!fixedConfig.cronExpression || typeof fixedConfig.cronExpression !== 'string') {
            const schedule = requirements.schedules?.[0] || '';
            fixedConfig.cronExpression = this.parseScheduleToCron(schedule);
          }
          break;

        case 'interval':
          if (fixedConfig.interval === undefined || fixedConfig.interval === null) {
            fixedConfig.interval = 3600;
            fixedConfig.unit = 'seconds';
          }
          break;

        case 'if_else':
          if (!fixedConfig.condition || typeof fixedConfig.condition !== 'string' || fixedConfig.condition.trim() === '') {
            fixedConfig.condition = '{{ $json }}';
          }
          break;

        case 'set_variable':
          if (!Array.isArray(fixedConfig.variables)) {
            fixedConfig.variables = [];
          }
          break;

        case 'openai_gpt':
        case 'anthropic_claude':
        case 'google_gemini':
          if (!fixedConfig.prompt || typeof fixedConfig.prompt !== 'string' || fixedConfig.prompt.trim() === '') {
            fixedConfig.prompt = requirements.primaryGoal || 'Process the input data';
          }
          break;

        case 'http_request':
        case 'http_post':
          if (!fixedConfig.url || typeof fixedConfig.url !== 'string' || fixedConfig.url.trim() === '') {
            const url = requirements.urls?.[0] || 'https://api.example.com/endpoint';
            fixedConfig.url = url;
          }
          break;

        case 'google_sheets':
          if (!fixedConfig.spreadsheetId || typeof fixedConfig.spreadsheetId !== 'string' || fixedConfig.spreadsheetId.trim() === '') {
            // Try to extract from URLs or use placeholder
            const sheetUrl = requirements.urls?.find((u: string) => u.includes('spreadsheets') || u.includes('sheets')) || '';
            if (sheetUrl) {
              const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
              if (match) {
                fixedConfig.spreadsheetId = match[1];
              }
            }
            if (!fixedConfig.spreadsheetId) {
              fixedConfig.spreadsheetId = 'PLACEHOLDER_SPREADSHEET_ID';
            }
          }
          if (!fixedConfig.sheetName) {
            fixedConfig.sheetName = 'Sheet1';
          }
          if (!fixedConfig.operation) {
            fixedConfig.operation = 'read';
          }
          break;

        case 'slack_message':
          if (!fixedConfig.message || typeof fixedConfig.message !== 'string' || fixedConfig.message.trim() === '') {
            fixedConfig.message = requirements.primaryGoal || 'Workflow notification';
          }
          break;
      }

      return {
        ...node,
        data: {
          ...node.data,
          config: fixedConfig,
        },
      };
    });

    // Fix 4: Remove invalid edges (edges pointing to non-existent nodes)
    const nodeIds = new Set(fixedNodes.map(n => n.id));
    fixedEdges = fixedEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    // Fix 5: Ensure sequential connections if edges are missing
    if (fixedEdges.length === 0 && fixedNodes.length > 1) {
      fixedEdges = [];
      for (let i = 0; i < fixedNodes.length - 1; i++) {
        fixedEdges.push({
          id: randomUUID(),
          source: fixedNodes[i].id,
          target: fixedNodes[i + 1].id,
          type: 'default',
        });
      }
    }

    return {
      nodes: fixedNodes,
      edges: fixedEdges,
    };
  }

  private async generateDocumentation(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    requirements: Requirements
  ): Promise<string> {
    const doc = `# Generated Workflow

## Goal
${requirements.primaryGoal}

## Steps
${requirements.keySteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Nodes
${nodes.map(n => `- ${n.data.label} (${n.type})`).join('\n')}

## Connections
${edges.map(e => `${e.source} → ${e.target}`).join('\n')}

Generated on: ${new Date().toISOString()}
`;
    
    return doc;
  }

  private async provideEnhancementSuggestions(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    requirements: Requirements
  ): Promise<any[]> {
    const suggestions: any[] = [];
    
    // Check for error handling
    const hasErrorHandling = nodes.some(n => n.type === 'error_handler');
    if (!hasErrorHandling) {
      suggestions.push({
        type: 'error_handling',
        suggestion: 'Add error handling nodes for better reliability',
        priority: 'high',
      });
    }
    
    // Check for logging
    const hasLogging = nodes.some(n => n.type === 'log_output');
    if (!hasLogging) {
      suggestions.push({
        type: 'logging',
        suggestion: 'Add logging nodes for debugging',
        priority: 'medium',
      });
    }
    
    return suggestions;
  }

  private calculateComplexity(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    
    if (nodeCount <= 3 && edgeCount <= 2) {
      return 'simple';
    } else if (nodeCount <= 10 && edgeCount <= 15) {
      return 'medium';
    } else {
      return 'complex';
    }
  }

  async iterativeImprovement(
    existingWorkflow: Workflow,
    feedback: string
  ): Promise<WorkflowImprovement> {
    // Analyze feedback
    const feedbackAnalysis = await this.analyzeFeedback(feedback, existingWorkflow);
    
    // Generate improvements
    const improvements = await this.generateImprovements(
      existingWorkflow,
      feedbackAnalysis
    );
    
    // Apply improvements
    const improvedWorkflow = await this.applyImprovements(
      existingWorkflow,
      improvements
    );
    
    return {
      improvedWorkflow,
      changes: improvements.changes,
      rationale: improvements.rationale,
      confidence: improvements.confidence,
    };
  }

  private async analyzeFeedback(feedback: string, workflow: Workflow): Promise<ImprovementAnalysis> {
    const prompt = `Analyze this feedback for a workflow:
Feedback: "${feedback}"
Current workflow has ${workflow.nodes.length} nodes and ${workflow.edges.length} edges.

Identify what needs to be changed. Respond with JSON:
{
  "issues": ["issue1", "issue2"],
  "suggestedChanges": ["change1", "change2"],
  "priority": "high|medium|low"
}`;
    
    try {
      const result = await ollamaOrchestrator.processRequest('workflow-analysis', {
        prompt,
        temperature: 0.3,
      });
      
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (error) {
      console.error('Error analyzing feedback:', error);
      return { issues: [], suggestedChanges: [], priority: 'medium' };
    }
  }

  private async generateImprovements(workflow: Workflow, analysis: ImprovementAnalysis): Promise<{
    changes: Change[];
    rationale: string;
    confidence: number;
  }> {
    // Generate specific improvements based on analysis
    const changes: Change[] = [];
    
    analysis.suggestedChanges?.forEach((change: string) => {
      changes.push({
        type: 'modification',
        description: change,
        impact: analysis.priority,
      });
    });
    
    return {
      changes,
      rationale: `Based on feedback analysis: ${analysis.issues?.join(', ')}`,
      confidence: 0.7,
    };
  }

  private async applyImprovements(workflow: Workflow, improvements: {
    changes: Change[];
    rationale: string;
    confidence: number;
  }): Promise<Workflow> {
    // Apply improvements to workflow
    // This is a simplified version - full implementation would modify nodes/edges
    return {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        improvements: improvements.changes,
        improvedAt: new Date().toISOString(),
      },
    };
  }

  private getNodeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getNodeCategory(type: string): string {
    if (['manual_trigger', 'webhook', 'schedule'].includes(type)) return 'triggers';
    if (['if_else', 'switch', 'loop'].includes(type)) return 'logic';
    if (['http_request', 'http_post'].includes(type)) return 'http_api';
    if (['openai_gpt', 'anthropic_claude'].includes(type)) return 'ai';
    if (['slack_message', 'log_output'].includes(type)) return 'output';
    return 'data';
  }

  private mapOutputTypeToNodeType(output: OutputDefinition): string {
    const desc = output.description.toLowerCase();
    
    if (desc.includes('slack')) return 'slack_message';
    if (desc.includes('email') || desc.includes('gmail')) return 'google_gmail';
    if (desc.includes('webhook') || desc.includes('http')) return 'http_post';
    if (desc.includes('log') || desc.includes('console')) return 'log_output';
    
    return 'log_output';
  }
}

// Export singleton instance
export const agenticWorkflowBuilder = new AgenticWorkflowBuilder();
