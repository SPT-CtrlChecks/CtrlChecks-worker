// Execute Single Node API Route
// Used by Debug Panel for isolated node execution
// Uses the same execution engine as full workflow execution

import { Request, Response } from 'express';
import { getSupabaseClient } from '../core/database/supabase-compat';
import { executeNode } from './execute-workflow';

// WorkflowNode interface must match execute-workflow.ts
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

/**
 * Execute a single node in isolation (for debug panel)
 * Uses the same execution engine as full workflow execution
 */
export default async function executeNodeHandler(req: Request, res: Response) {
  const supabase = getSupabaseClient();
  const { runId, nodeId, nodeType, config: nodeConfig, input, workflowId } = req.body;

  console.log(`[DEBUG] Execute node request:`, {
    runId,
    nodeId,
    nodeType,
    workflowId,
    hasInput: !!input,
    hasConfig: !!nodeConfig,
  });

  // Validate required fields
  if (!nodeId || !nodeType || !workflowId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: nodeId, nodeType, and workflowId are required',
    });
  }

  const startTime = Date.now();

  try {
    // Fetch workflow to get full context (needed for template resolution)
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('[DEBUG] Workflow fetch error:', workflowError);
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Get user_id from workflow or auth
    const userId = workflow.user_id;

    // Build node object in the format expected by executeNode
    const node: WorkflowNode = {
      id: nodeId,
      type: nodeType,
      data: {
        label: nodeId, // Fallback label
        type: nodeType,
        category: 'custom',
        config: nodeConfig || {},
      },
    };

    // If node exists in workflow, use its actual data
    const nodes = (workflow.nodes || []) as WorkflowNode[];
    const existingNode = nodes.find(n => n.id === nodeId);
    if (existingNode) {
      node.data = existingNode.data;
      // Merge provided config with existing config
      if (nodeConfig) {
        node.data.config = { ...node.data.config, ...nodeConfig };
      }
    }

    // Build nodeOutputs context for template resolution
    // In debug mode, we use the provided input as the context
    // This must match the structure expected by resolveTemplate for $json resolution
    const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const nodeOutputs: Record<string, unknown> = {
      trigger: inputObj,
      input: inputObj,
      // Spread input properties at root level for direct access
      ...inputObj,
      // Ensure $json and json point to input data (for {{$json.value1}} syntax)
      $json: inputObj,
      json: inputObj,
    };

    // Execute the node using the same engine as full workflow
    console.log(`[DEBUG] Executing node: ${node.data.label} (${nodeType})`);
    const output = await executeNode(
      node,
      input || {},
      nodeOutputs,
      supabase,
      workflowId,
      userId
    );

    const executionTime = Date.now() - startTime;

    console.log(`[DEBUG] Node execution completed in ${executionTime}ms`);

    // Return response in format expected by frontend
    return res.json({
      success: true,
      output,
      executionTime,
      nodeId,
      nodeType,
      runId,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[DEBUG] Node execution error:', error);

    return res.status(500).json({
      success: false,
      error: errorMessage,
      executionTime,
      nodeId,
      nodeType,
      runId,
    });
  }
}
