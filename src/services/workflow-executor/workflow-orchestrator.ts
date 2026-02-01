/**
 * Workflow Orchestrator
 * Coordinates workflow execution with real-time updates
 */

import { EventEmitter } from 'events';
import { ExecutionStateManager, NodeStatus } from './execution-state-manager';
import { VisualizationService } from './visualization-service';
import { executeNode } from '../../api/execute-workflow';
import { getSupabaseClient } from '../../core/database/supabase-compat';
import { LRUNodeOutputsCache } from '../../core/cache/lru-node-outputs-cache';

export interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    type: string;
    category: string;
    config: Record<string, unknown>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  userId?: string;
  input: unknown;
  nodeOutputs: LRUNodeOutputsCache;
  ifElseResults: Record<string, boolean>;
  switchResults: Record<string, string | null>;
}

/**
 * Workflow Orchestrator
 * Manages workflow execution with real-time state updates
 */
export class WorkflowOrchestrator extends EventEmitter {
  private stateManager: ExecutionStateManager;
  private visualizationService: VisualizationService;
  private supabase: any;

  constructor(
    stateManager: ExecutionStateManager,
    visualizationService: VisualizationService
  ) {
    super();
    this.stateManager = stateManager;
    this.visualizationService = visualizationService;
    this.supabase = getSupabaseClient();
  }

  /**
   * Execute workflow with real-time updates
   */
  async executeWorkflow(
    workflowId: string,
    input: unknown,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    executionId: string,
    userId?: string
  ): Promise<{
    status: 'success' | 'failed';
    output: unknown;
    logs: any[];
  }> {
    // Initialize execution state
    const executionOrder = this.topologicalSort(nodes, edges);
    const totalNodes = executionOrder.length;

    this.stateManager.initializeExecution(
      executionId,
      workflowId,
      totalNodes,
      input
    );

    // Broadcast execution started
    this.visualizationService.broadcastNodeUpdate(
      executionId,
      'execution',
      {
        status: 'running',
        timestamp: Date.now(),
      }
    );

    const context: ExecutionContext = {
      executionId,
      workflowId,
      userId,
      input,
      nodeOutputs: (() => {
        const cache = new LRUNodeOutputsCache();
        // Set initial trigger output if needed
        return cache;
      })(),
      ifElseResults: {},
      switchResults: {},
    };

    const logs: any[] = [];
    let finalOutput: unknown = input;
    let hasError = false;
    let errorMessage = '';

    // Execute nodes sequentially
    for (let i = 0; i < executionOrder.length; i++) {
      const node = executionOrder[i];

      // Update node status to pending
      this.stateManager.updateNodeState(
        executionId,
        node.id,
        node.data.label,
        'pending'
      );

      // Update node status to running
      this.stateManager.updateNodeState(
        executionId,
        node.id,
        node.data.label,
        'running',
        {
          input: this.getNodeInput(node, edges, context),
        }
      );

      try {
        // Determine node input
        const nodeInput = this.getNodeInput(node, edges, context);

        // Execute node
        const nodeOutput = await executeNode(
          node,
          nodeInput,
          context.nodeOutputs,
          this.supabase,
          workflowId,
          userId
        );

        // Store output
        context.nodeOutputs.set(node.id, nodeOutput);
        finalOutput = nodeOutput;

        // Update node status to success
        this.stateManager.updateNodeState(
          executionId,
          node.id,
          node.data.label,
          'success',
          {
            output: nodeOutput,
          }
        );

        // Add log entry
        logs.push({
          nodeId: node.id,
          nodeName: node.data.label,
          status: 'success',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          input: nodeInput,
          output: nodeOutput,
        });

        // Handle special node types
        if (node.data.type === 'if_else') {
          const condition = this.evaluateCondition(node, context);
          context.ifElseResults[node.id] = condition;
        } else if (node.data.type === 'switch') {
          const caseValue = this.evaluateSwitch(node, context);
          context.switchResults[node.id] = caseValue;
        }
      } catch (error: any) {
        hasError = true;
        errorMessage = error.message || 'Unknown error';

        // Update node status to error
        this.stateManager.updateNodeState(
          executionId,
          node.id,
          node.data.label,
          'error',
          {
            error: errorMessage,
          }
        );

        // Add error log entry
        logs.push({
          nodeId: node.id,
          nodeName: node.data.label,
          status: 'failed',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: errorMessage,
        });

        // Break execution on error (unless configured to continue)
        const continueOnError = (node.data.config as any)?.continueOnError;
        if (!continueOnError) {
          break;
        }
      }
    }

    // Set final execution state
    if (hasError) {
      this.stateManager.setExecutionError(executionId, errorMessage);
    } else {
      this.stateManager.setExecutionOutput(executionId, finalOutput);
    }

    return {
      status: hasError ? 'failed' : 'success',
      output: finalOutput,
      logs,
    };
  }

  /**
   * Topological sort to determine execution order
   */
  private topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
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
   * Get input for a node based on incoming edges
   */
  private getNodeInput(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: ExecutionContext
  ): unknown {
    const inputEdges = edges.filter(e => e.target === node.id);

    if (inputEdges.length === 0) {
      return context.input;
    }

    if (inputEdges.length === 1) {
      const sourceNodeId = inputEdges[0].source;
      const sourceOutput = context.nodeOutputs.get(sourceNodeId);
      return sourceOutput !== undefined ? sourceOutput : context.input;
    }

    // Multiple inputs - merge them
    const inputs: Record<string, unknown> = {};
    inputEdges.forEach(edge => {
      const sourceOutput = context.nodeOutputs.get(edge.source);
      if (sourceOutput !== undefined) {
        const key = edge.sourceHandle || edge.source;
        inputs[key] = sourceOutput;
      }
    });

    return Object.keys(inputs).length > 0 ? inputs : context.input;
  }

  /**
   * Evaluate if-else condition
   */
  private evaluateCondition(node: WorkflowNode, context: ExecutionContext): boolean {
    const config = node.data.config as any;
    const condition = config?.condition || '';
    
    if (!condition) return true;

    // Simple condition evaluation
    // In production, use a proper expression evaluator
    try {
      const input = this.getNodeInput(node, [], context);
      const inputObj = typeof input === 'object' && input !== null ? input : { value: input };
      
      // Replace variables in condition
      let evaluatedCondition = condition;
      const allOutputs = context.nodeOutputs.getAll();
      Object.keys(allOutputs).forEach(key => {
        const value = allOutputs[key];
        evaluatedCondition = evaluatedCondition.replace(
          new RegExp(`\\$\\{${key}\\}`, 'g'),
          JSON.stringify(value)
        );
      });

      // Evaluate condition (simplified - use proper evaluator in production)
      return eval(evaluatedCondition);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate switch case
   */
  private evaluateSwitch(node: WorkflowNode, context: ExecutionContext): string | null {
    const config = node.data.config as any;
    const value = config?.value || '';
    const cases = config?.cases || {};

    const input = this.getNodeInput(node, [], context);
    const inputValue = typeof input === 'object' && input !== null 
      ? (input as any)[value] || input 
      : input;

    // Find matching case
    for (const [caseValue, caseConfig] of Object.entries(cases)) {
      if (String(inputValue) === String(caseValue)) {
        return caseValue;
      }
    }

    return config?.defaultCase || null;
  }
}
