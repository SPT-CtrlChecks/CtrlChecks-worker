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

  private initializeNodeLibrary(): void {
    // Comprehensive node library based on node_reference_full.md
    const nodeTypes = [
      // Triggers
      { type: 'manual_trigger', category: 'triggers', label: 'Manual Trigger', description: 'Start workflow manually' },
      { type: 'webhook', category: 'triggers', label: 'Webhook', description: 'Trigger from HTTP requests' },
      { type: 'schedule', category: 'triggers', label: 'Schedule', description: 'Execute at specific times' },
      { type: 'interval', category: 'triggers', label: 'Interval', description: 'Run at fixed intervals' },
      { type: 'chat_trigger', category: 'triggers', label: 'Chat Trigger', description: 'Trigger from chat/AI interactions' },
      { type: 'form', category: 'triggers', label: 'Form', description: 'Trigger from form submissions' },
      
      // Logic
      { type: 'if_else', category: 'logic', label: 'If/Else', description: 'Conditional branching' },
      { type: 'switch', category: 'logic', label: 'Switch', description: 'Multi-path conditional logic' },
      { type: 'loop', category: 'logic', label: 'Loop', description: 'Iterate over array items' },
      { type: 'filter', category: 'logic', label: 'Filter', description: 'Filter array items by condition' },
      { type: 'merge', category: 'logic', label: 'Merge', description: 'Merge multiple inputs' },
      { type: 'error_handler', category: 'logic', label: 'Error Handler', description: 'Handle errors with retries' },
      
      // Data Processing
      { type: 'javascript', category: 'data', label: 'JavaScript', description: 'Execute JavaScript code' },
      { type: 'set_variable', category: 'data', label: 'Set Variable', description: 'Set workflow variables' },
      { type: 'json_parser', category: 'data', label: 'JSON Parser', description: 'Parse JSON data' },
      { type: 'text_formatter', category: 'data', label: 'Text Formatter', description: 'Format text strings' },
      { type: 'date_time', category: 'data', label: 'Date/Time', description: 'Date and time operations' },
      { type: 'math', category: 'data', label: 'Math', description: 'Mathematical operations' },
      
      // AI Nodes
      { type: 'openai_gpt', category: 'ai', label: 'OpenAI GPT', description: 'GPT chat completion' },
      { type: 'anthropic_claude', category: 'ai', label: 'Claude', description: 'Anthropic Claude chat' },
      { type: 'google_gemini', category: 'ai', label: 'Gemini', description: 'Google Gemini chat' },
      { type: 'ollama', category: 'ai', label: 'Ollama', description: 'Local Ollama models' },
      { type: 'text_summarizer', category: 'ai', label: 'Text Summarizer', description: 'Summarize text' },
      { type: 'sentiment_analyzer', category: 'ai', label: 'Sentiment Analyzer', description: 'Analyze sentiment' },
      
      // HTTP/API
      { type: 'http_request', category: 'http_api', label: 'HTTP Request', description: 'Make HTTP requests' },
      { type: 'http_post', category: 'http_api', label: 'HTTP POST', description: 'POST request' },
      { type: 'respond_to_webhook', category: 'http_api', label: 'Respond to Webhook', description: 'Respond to webhook' },
      
      // Google Services
      { type: 'google_sheets', category: 'google', label: 'Google Sheets', description: 'Read/write Google Sheets' },
      { type: 'google_drive', category: 'google', label: 'Google Drive', description: 'Google Drive operations' },
      { type: 'google_gmail', category: 'google', label: 'Gmail', description: 'Send/receive emails' },
      { type: 'google_calendar', category: 'google', label: 'Google Calendar', description: 'Calendar operations' },
      
      // Output
      { type: 'slack_message', category: 'output', label: 'Slack', description: 'Send Slack messages' },
      { type: 'log_output', category: 'output', label: 'Log Output', description: 'Log data' },
      
      // Database
      { type: 'database_read', category: 'database', label: 'Database Read', description: 'Read from database' },
      { type: 'database_write', category: 'database', label: 'Database Write', description: 'Write to database' },
      { type: 'supabase', category: 'database', label: 'Supabase', description: 'Supabase operations' },
    ];

    nodeTypes.forEach(node => {
      this.nodeLibrary.set(node.type, node);
    });
  }

  async generateFromPrompt(
    userPrompt: string,
    constraints?: any
  ): Promise<{
    workflow: Workflow;
    documentation: string;
    suggestions: any[];
    estimatedComplexity: string;
  }> {
    console.log(`🤖 Generating workflow from prompt: "${userPrompt}"`);
    
    // Step 1: Analyze requirements
    const requirements = await this.analyzeRequirements(userPrompt, constraints);
    
    // Step 2: Generate workflow structure
    const structure = await this.generateStructure(requirements);
    
    // Step 3: Select appropriate nodes
    const nodes = await this.selectNodes(structure, requirements);
    
    // Step 4: Configure nodes intelligently
    const configuredNodes = await this.configureNodes(nodes, requirements);
    
    // Step 5: Create connections
    const connections = await this.createConnections(configuredNodes, requirements);
    
    // Step 6: Validate workflow with type validator
    const typeValidation = TypeValidator.validateWorkflow({
      nodes: configuredNodes,
      edges: connections,
    });
    
    if (!typeValidation.isValid) {
      console.warn('⚠️  Type validation warnings:', typeValidation.errors);
    }
    
    const validation = await this.validateWorkflow({
      nodes: configuredNodes,
      edges: connections,
    });
    
    // Step 7: Generate documentation
    const documentation = await this.generateDocumentation(
      configuredNodes,
      connections,
      requirements
    );
    
    return {
      workflow: {
        nodes: configuredNodes,
        edges: connections,
        metadata: {
          generatedFrom: userPrompt,
          requirements,
          validation,
          timestamp: new Date().toISOString(),
        },
      },
      documentation,
      suggestions: await this.provideEnhancementSuggestions(
        configuredNodes,
        connections,
        requirements
      ),
      estimatedComplexity: this.calculateComplexity(configuredNodes, connections),
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

  async analyzeRequirements(
    prompt: string,
    constraints?: any
  ): Promise<Requirements> {
    const analysisPrompt = `Analyze this workflow requirement and extract key information:
Requirement: "${prompt}"
${constraints ? `Constraints: ${JSON.stringify(constraints)}` : ''}

Respond with JSON:
{
  "primaryGoal": "...",
  "keySteps": ["step1", "step2", ...],
  "inputs": ["input1", "input2", ...],
  "outputs": ["output1", "output2", ...],
  "constraints": ["constraint1", ...],
  "complexity": "simple|medium|complex"
}`;
    
    try {
      const result = await ollamaOrchestrator.processRequest('workflow-generation', {
        prompt: analysisPrompt,
        temperature: 0.3,
      });
      
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      
      return {
        primaryGoal: parsed.primaryGoal || prompt,
        keySteps: parsed.keySteps || [],
        inputs: parsed.inputs || [],
        outputs: parsed.outputs || [],
        constraints: parsed.constraints || [],
        complexity: parsed.complexity || 'medium',
      };
    } catch (error) {
      console.error('Error analyzing requirements:', error);
      // Fallback
      return {
        primaryGoal: prompt,
        keySteps: [],
        inputs: [],
        outputs: [],
        constraints: [],
        complexity: 'medium',
      };
    }
  }

  private async generateStructure(requirements: Requirements): Promise<WorkflowGenerationStructure> {
    // Generate a logical structure for the workflow
    const structure: WorkflowGenerationStructure = {
      trigger: null,
      steps: [],
      outputs: [],
    };
    
    // Determine trigger type
    if (requirements.inputs.some(i => i.toLowerCase().includes('webhook'))) {
      structure.trigger = 'webhook';
    } else if (requirements.inputs.some(i => i.toLowerCase().includes('schedule'))) {
      structure.trigger = 'schedule';
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

  private inferStepType(step: string): string {
    const stepLower = step.toLowerCase();
    
    if (stepLower.includes('http') || stepLower.includes('api') || stepLower.includes('request')) {
      return 'http_request';
    }
    if (stepLower.includes('ai') || stepLower.includes('chat') || stepLower.includes('generate')) {
      return 'openai_gpt';
    }
    if (stepLower.includes('sheet') || stepLower.includes('spreadsheet')) {
      return 'google_sheets';
    }
    if (stepLower.includes('code') || stepLower.includes('process') || stepLower.includes('transform')) {
      return 'javascript';
    }
    if (stepLower.includes('if') || stepLower.includes('condition') || stepLower.includes('check')) {
      return 'if_else';
    }
    
    return 'set_variable';
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
      const node: WorkflowNode = {
        id: randomUUID(),
        type: step.type,
        position: { x: xPosition, y: 100 + (index * ySpacing) },
        data: {
          type: step.type,
          label: step.description || this.getNodeLabel(step.type),
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
      const node: WorkflowNode = {
        id: randomUUID(),
        type: nodeType,
        position: { x: xPosition, y: 100 + (index * ySpacing) },
        data: {
          type: nodeType,
          label: output.description || this.getNodeLabel(nodeType),
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
    requirements: Requirements
  ): Promise<WorkflowNode[]> {
    // Configure each node based on requirements
    return nodes.map(node => {
      const config = this.generateNodeConfig(node, requirements);
      return {
        ...node,
        data: {
          ...node.data,
          config,
        },
      };
    });
  }

  private generateNodeConfig(node: WorkflowNode, requirements: Requirements): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    
    switch (node.type) {
      case 'http_request':
        config.method = 'GET';
        config.url = 'https://api.example.com/endpoint';
        break;
      
      case 'if_else':
        config.condition = '{{ $json.property }} === "value"';
        break;
      
      case 'set_variable':
        config.variables = [];
        break;
      
      case 'openai_gpt':
        config.model = 'gpt-3.5-turbo';
        config.prompt = requirements.primaryGoal;
        break;
      
      case 'google_sheets':
        config.operation = 'read';
        break;
      
      default:
        break;
    }
    
    return config;
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
    }
    
    // Check for trigger
    const hasTrigger = workflow.nodes.some(n => 
      ['manual_trigger', 'webhook', 'schedule'].includes(n.type)
    );
    if (!hasTrigger) {
      warnings.push('Workflow should have a trigger node');
    }
    
    // Check connections
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
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
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
