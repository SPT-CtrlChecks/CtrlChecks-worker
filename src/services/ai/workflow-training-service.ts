// Workflow Training Service
// Provides training examples for few-shot learning in workflow generation and execution

import * as fs from 'fs';
import * as path from 'path';
import { trainingMonitor } from './training-monitor';

export interface TrainingWorkflow {
  id: string;
  category: string;
  goal: string;
  phase1: {
    step1: { userPrompt: string };
    step2?: { clarificationQuestions?: string[]; userResponses?: Record<string, string> };
    step3: { systemPrompt: string; wordCount: number; temperature?: number };
    step4: { requirements: any };
    step5: { structure?: any; selectedNodes: string[]; nodeConfigurations?: any; connections: string[] };
    step6?: { validationChecks?: string[]; autoHealing?: any };
    step7?: { complexityScore?: number; enhancementSuggestions?: string[] };
  };
  phase2: {
    executionInitialization?: any;
    executionLoop: Array<{
      iteration: number;
      state?: string;
      availableActions?: string[];
      reasoning?: string;
      execution: string;
      stateUpdated?: string;
    }>;
    executionFinalization: { totalIterations: number; goalAchieved: boolean };
  };
}

export interface TrainingDataset {
  version: string;
  description: string;
  totalWorkflows: number;
  workflows: TrainingWorkflow[];
  trainingMetrics?: any;
}

export class WorkflowTrainingService {
  private dataset: TrainingDataset | null = null;
  private datasetPath: string;

  constructor() {
    // Resolve path relative to the compiled output location
    // In development: __dirname = src/services/ai
    // In production: __dirname = dist/services/ai
    const basePath = __dirname.includes('dist') 
      ? path.join(__dirname, '../../data/workflow_training_dataset.json')
      : path.join(__dirname, '../../../data/workflow_training_dataset.json');
    this.datasetPath = path.resolve(basePath);
    this.loadDataset();
  }

  /**
   * Load training dataset from file
   */
  private loadDataset(): void {
    try {
      // Check if file exists
      if (!fs.existsSync(this.datasetPath)) {
        console.error(`❌ Training dataset file not found at: ${this.datasetPath}`);
        console.error(`   Please ensure the file exists at: CtrlChecks-worker/data/workflow_training_dataset.json`);
        this.dataset = null;
        return;
      }

      const fileContent = fs.readFileSync(this.datasetPath, 'utf-8');
      this.dataset = JSON.parse(fileContent) as TrainingDataset;
      
      // Validate dataset structure
      if (!this.dataset.workflows || !Array.isArray(this.dataset.workflows)) {
        console.error('❌ Invalid training dataset: workflows array is missing or invalid');
        this.dataset = null;
        return;
      }

      const workflowCount = this.dataset.workflows.length;
      console.log(`✅ Loaded training dataset with ${workflowCount} workflows`);
      
      // Log categories
      const categories = new Set(this.dataset.workflows.map(w => w.category).filter(Boolean));
      if (categories.size > 0) {
        console.log(`   Categories: ${Array.from(categories).join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Failed to load training dataset:', error);
      if (error instanceof SyntaxError) {
        console.error('   This appears to be a JSON syntax error. Please validate the dataset file.');
      }
      this.dataset = null;
    }
  }

  /**
   * Reload training dataset (hot reload)
   */
  reloadDataset(): { success: boolean; message: string; workflows?: number } {
    try {
      const fileContent = fs.readFileSync(this.datasetPath, 'utf-8');
      this.dataset = JSON.parse(fileContent) as TrainingDataset;
      const workflowCount = this.dataset?.workflows.length || 0;
      console.log(`✅ Reloaded training dataset with ${workflowCount} workflows`);
      return {
        success: true,
        message: `Dataset reloaded successfully`,
        workflows: workflowCount,
      };
    } catch (error) {
      console.error('❌ Failed to reload training dataset:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get similar workflows for few-shot learning based on user prompt
   * Enhanced with better similarity matching algorithm
   */
  getSimilarWorkflows(userPrompt: string, limit: number = 3): TrainingWorkflow[] {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    const promptLower = userPrompt.toLowerCase();
    
    // Extract meaningful keywords (filter out common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);
    const keywords = promptLower
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .map(w => w.replace(/[^\w]/g, ''));

    const scored = this.dataset.workflows.map(workflow => {
      const workflowText = `${workflow.goal} ${workflow.phase1.step1.userPrompt} ${workflow.category}`.toLowerCase();
      let score = 0;

      // Keyword matching with weights
      keywords.forEach(keyword => {
        if (workflowText.includes(keyword)) {
          // Higher weight for exact matches in goal or prompt
          if (workflow.goal.toLowerCase().includes(keyword)) {
            score += 3;
          }
          if (workflow.phase1.step1.userPrompt.toLowerCase().includes(keyword)) {
            score += 2;
          }
          if (workflow.category && workflow.category.toLowerCase().includes(keyword)) {
            score += 4;
          }
          // General match
          if (workflowText.includes(keyword)) {
            score += 1;
          }
        }
      });

      // Category matching boost
      if (workflow.category) {
        const categoryLower = workflow.category.toLowerCase();
        if (promptLower.includes(categoryLower) || categoryLower.split(/\s+/).some(catWord => promptLower.includes(catWord))) {
          score += 5;
        }
      }

      // Platform/technology matching
      const platforms = ['slack', 'gmail', 'google', 'hubspot', 'salesforce', 'freshdesk', 'crm', 'api', 'webhook', 'email', 'calendar', 'sheets'];
      platforms.forEach(platform => {
        if (promptLower.includes(platform) && workflowText.includes(platform)) {
          score += 3;
        }
      });

      // Action verb matching
      const actionVerbs = ['build', 'create', 'generate', 'send', 'monitor', 'track', 'analyze', 'automate', 'schedule', 'notify', 'route', 'qualify', 'screen'];
      actionVerbs.forEach(verb => {
        if (promptLower.includes(verb) && workflowText.includes(verb)) {
          score += 2;
        }
      });

      return { workflow, score };
    });

    // Filter out zero-score workflows and sort
    const filtered = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // If we have results, return them; otherwise return top workflows by default
    if (filtered.length > 0) {
      return filtered.slice(0, limit).map(item => item.workflow);
    } else {
      // Fallback: return workflows with most nodes (likely more comprehensive)
      return this.dataset.workflows
        .sort((a, b) => {
          const aNodes = a.phase1.step5?.selectedNodes?.length || 0;
          const bNodes = b.phase1.step5?.selectedNodes?.length || 0;
          return bNodes - aNodes;
        })
        .slice(0, limit);
    }
  }

  /**
   * Get training examples for system prompt generation
   */
  getSystemPromptExamples(limit: number = 2): Array<{ prompt: string; systemPrompt: string; wordCount: number }> {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows
      .filter(w => w.phase1.step3?.systemPrompt)
      .slice(0, limit)
      .map(w => ({
        prompt: w.phase1.step1.userPrompt,
        systemPrompt: w.phase1.step3.systemPrompt,
        wordCount: w.phase1.step3.wordCount || 0,
      }));
  }

  /**
   * Get training examples for requirements extraction
   */
  getRequirementsExamples(limit: number = 2): Array<{ prompt: string; requirements: any }> {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows
      .filter(w => w.phase1.step4?.requirements)
      .slice(0, limit)
      .map(w => ({
        prompt: w.phase1.step1.userPrompt,
        requirements: w.phase1.step4.requirements,
      }));
  }

  /**
   * Get training examples for node selection
   */
  getNodeSelectionExamples(limit: number = 3): Array<{
    goal: string;
    selectedNodes: string[];
    nodeConfigurations?: any;
    connections: string[];
  }> {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows
      .filter(w => w.phase1.step5?.selectedNodes && w.phase1.step5.selectedNodes.length > 0)
      .slice(0, limit)
      .map(w => ({
        goal: w.goal,
        selectedNodes: w.phase1.step5.selectedNodes,
        nodeConfigurations: w.phase1.step5.nodeConfigurations,
        connections: w.phase1.step5.connections,
      }));
  }

  /**
   * Get training examples for execution reasoning
   */
  getExecutionExamples(limit: number = 3): Array<{
    goal: string;
    executionLoop: Array<{
      iteration: number;
      state?: string;
      availableActions?: string[];
      reasoning?: string;
      execution: string;
    }>;
    totalIterations: number;
    goalAchieved: boolean;
  }> {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows
      .filter(w => w.phase2?.executionLoop && w.phase2.executionLoop.length > 0)
      .slice(0, limit)
      .map(w => ({
        goal: w.goal,
        executionLoop: w.phase2.executionLoop,
        totalIterations: w.phase2.executionFinalization.totalIterations,
        goalAchieved: w.phase2.executionFinalization.goalAchieved,
      }));
  }

  /**
   * Build few-shot prompt for system prompt generation
   */
  buildSystemPromptFewShotPrompt(userPrompt: string): string {
    // Check if dataset is loaded
    if (!this.isLoaded()) {
      console.warn('⚠️  Training dataset not loaded, skipping few-shot examples');
      trainingMonitor.recordUsage('systemPrompt', userPrompt, 0, false);
      return '';
    }

    try {
      const examples = this.getSystemPromptExamples(2);
      
      if (examples.length === 0) {
        trainingMonitor.recordUsage('systemPrompt', userPrompt, 0, false);
        return '';
      }

      let prompt = 'Here are examples of how to generate concise system prompts (20-30 words) from user prompts:\n\n';
      
      examples.forEach((example, idx) => {
        prompt += `Example ${idx + 1}:\n`;
        prompt += `User Prompt: "${example.prompt}"\n`;
        prompt += `System Prompt: "${example.systemPrompt}" (${example.wordCount} words)\n\n`;
      });

      prompt += `Now generate a system prompt for this user prompt:\n`;
      prompt += `User Prompt: "${userPrompt}"\n`;
      prompt += `System Prompt:`;

      trainingMonitor.recordUsage('systemPrompt', userPrompt, examples.length, true);
      return prompt;
    } catch (error) {
      console.error('Error building system prompt few-shot prompt:', error);
      trainingMonitor.recordUsage('systemPrompt', userPrompt, 0, false);
      return '';
    }
  }

  /**
   * Build few-shot prompt for requirements extraction
   */
  buildRequirementsFewShotPrompt(userPrompt: string, systemPrompt: string): string {
    // Check if dataset is loaded
    if (!this.isLoaded()) {
      console.warn('⚠️  Training dataset not loaded, skipping few-shot examples');
      trainingMonitor.recordUsage('requirements', userPrompt, 0, false);
      return '';
    }

    try {
      const examples = this.getRequirementsExamples(2);
      
      if (examples.length === 0) {
        trainingMonitor.recordUsage('requirements', userPrompt, 0, false);
        return '';
      }

      let prompt = 'Here are examples of how to extract structured requirements from user prompts:\n\n';
      
      examples.forEach((example, idx) => {
        prompt += `Example ${idx + 1}:\n`;
        prompt += `User Prompt: "${example.prompt}"\n`;
        prompt += `Requirements: ${JSON.stringify(example.requirements, null, 2)}\n\n`;
      });

      prompt += `Now extract requirements for this user prompt:\n`;
      prompt += `User Prompt: "${userPrompt}"\n`;
      prompt += `System Prompt: "${systemPrompt}"\n`;
      prompt += `Requirements (JSON):`;

      trainingMonitor.recordUsage('requirements', userPrompt, examples.length, true);
      return prompt;
    } catch (error) {
      console.error('Error building requirements few-shot prompt:', error);
      trainingMonitor.recordUsage('requirements', userPrompt, 0, false);
      return '';
    }
  }

  /**
   * Build few-shot prompt for node selection
   */
  buildNodeSelectionFewShotPrompt(requirements: any, availableNodes: string[]): string {
    const examples = this.getNodeSelectionExamples(3);
    
    if (examples.length === 0) {
      return '';
    }

    let prompt = 'Here are examples of how to select appropriate nodes for workflows:\n\n';
    
    examples.forEach((example, idx) => {
      prompt += `Example ${idx + 1}:\n`;
      prompt += `Goal: "${example.goal}"\n`;
      prompt += `Selected Nodes: ${example.selectedNodes.join(', ')}\n`;
      if (example.connections && example.connections.length > 0) {
        prompt += `Connections: ${example.connections.slice(0, 3).join('; ')}...\n`;
      }
      prompt += `\n`;
    });

    prompt += `Now select nodes for this workflow:\n`;
    prompt += `Requirements: ${JSON.stringify(requirements, null, 2)}\n`;
    prompt += `Available Nodes: ${availableNodes.slice(0, 20).join(', ')}...\n`;
    prompt += `Selected Nodes:`;

    return prompt;
  }

  /**
   * Build few-shot prompt for execution reasoning
   */
  buildExecutionReasoningFewShotPrompt(goal: string, currentState: any, availableActions: any[]): string {
    // Check if dataset is loaded
    if (!this.isLoaded()) {
      console.warn('⚠️  Training dataset not loaded, skipping few-shot examples');
      trainingMonitor.recordUsage('execution', goal, 0, false);
      return '';
    }

    try {
      const examples = this.getExecutionExamples(2);
      
      if (examples.length === 0) {
        trainingMonitor.recordUsage('execution', goal, 0, false);
        return '';
      }

      let prompt = 'Here are examples of how to reason about workflow execution:\n\n';
      
      examples.forEach((example, idx) => {
        prompt += `Example ${idx + 1}:\n`;
        prompt += `Goal: "${example.goal}"\n`;
        prompt += `Execution Steps:\n`;
        example.executionLoop.slice(0, 3).forEach(step => {
          prompt += `  Iteration ${step.iteration}: ${step.state || 'N/A'} → ${step.execution}`;
          if (step.reasoning) {
            prompt += ` (Reasoning: ${step.reasoning})`;
          }
          prompt += `\n`;
        });
        prompt += `Result: Goal achieved in ${example.totalIterations} iterations\n\n`;
      });

      prompt += `Now reason about this execution:\n`;
      prompt += `Goal: "${goal}"\n`;
      prompt += `Current State: ${JSON.stringify(currentState, null, 2)}\n`;
      prompt += `Available Actions: ${availableActions.map(a => a.name).join(', ')}\n`;
      prompt += `Reasoning:`;

      trainingMonitor.recordUsage('execution', goal, examples.length, true);
      return prompt;
    } catch (error) {
      console.error('Error building execution reasoning few-shot prompt:', error);
      trainingMonitor.recordUsage('execution', goal, 0, false);
      return '';
    }
  }

  /**
   * Get workflow by category
   */
  getWorkflowsByCategory(category: string): TrainingWorkflow[] {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows.filter(w => 
      w.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    const categories = new Set<string>();
    this.dataset.workflows.forEach(w => {
      if (w.category) {
        categories.add(w.category);
      }
    });

    return Array.from(categories);
  }

  /**
   * Get training statistics
   */
  getTrainingStats(): any {
    if (!this.dataset) {
      return null;
    }

    // Calculate additional statistics
    const nodeUsage = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    let totalNodes = 0;
    let totalIterations = 0;

    this.dataset.workflows.forEach(workflow => {
      // Count nodes
      if (workflow.phase1.step5?.selectedNodes) {
        workflow.phase1.step5.selectedNodes.forEach(node => {
          nodeUsage.set(node, (nodeUsage.get(node) || 0) + 1);
          totalNodes++;
        });
      }

      // Count categories
      if (workflow.category) {
        categoryCounts.set(workflow.category, (categoryCounts.get(workflow.category) || 0) + 1);
      }

      // Count iterations
      if (workflow.phase2?.executionFinalization?.totalIterations) {
        totalIterations += workflow.phase2.executionFinalization.totalIterations;
      }
    });

    // Get top nodes
    const topNodes = Array.from(nodeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([node, count]) => ({ node, count }));

    return {
      totalWorkflows: this.dataset.totalWorkflows,
      categories: this.getAllCategories(),
      categoryCounts: Object.fromEntries(categoryCounts),
      metrics: this.dataset.trainingMetrics,
      statistics: {
        totalNodes,
        averageNodesPerWorkflow: totalNodes / this.dataset.totalWorkflows,
        totalIterations,
        averageIterationsPerWorkflow: totalIterations / this.dataset.totalWorkflows,
        uniqueNodes: nodeUsage.size,
        topNodes,
      },
    };
  }

  /**
   * Check if training dataset is loaded
   */
  isLoaded(): boolean {
    return this.dataset !== null && this.dataset.workflows !== undefined;
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(id: string): TrainingWorkflow | null {
    if (!this.dataset || !this.dataset.workflows) {
      return null;
    }

    return this.dataset.workflows.find(w => w.id === id) || null;
  }

  /**
   * Get all workflow IDs
   */
  getAllWorkflowIds(): string[] {
    if (!this.dataset || !this.dataset.workflows) {
      return [];
    }

    return this.dataset.workflows.map(w => w.id);
  }
}

// Export singleton instance
export const workflowTrainingService = new WorkflowTrainingService();

