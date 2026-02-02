// Generate Workflow Route
// Migrated from Supabase Edge Function
// Handles workflow generation and analysis

import { Request, Response } from 'express';
import { agenticWorkflowBuilder } from '../services/ai/workflow-builder';
import { workflowAnalyzer } from '../services/ai/workflow-analyzer';
import { enhancedWorkflowAnalyzer } from '../services/ai/enhanced-workflow-analyzer';
import { requirementsExtractor } from '../services/ai/requirements-extractor';
import { workflowValidator } from '../services/ai/workflow-validator';

export default async function generateWorkflow(req: Request, res: Response) {
  try {
    const { prompt, mode = 'create', currentWorkflow, executionHistory, answers } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ 
        error: 'Prompt is required',
        details: 'Please provide a description of the workflow you want to generate.'
      });
    }

    // Handle analyze mode - Step 2: Questions for confirming
    if (mode === 'analyze') {
      try {
        // Use EnhancedWorkflowAnalyzer for multi-node detection
        const analysis = await enhancedWorkflowAnalyzer.analyzePromptWithNodeOptions(prompt, {
          existingWorkflow: currentWorkflow,
        });

        return res.json({
          summary: analysis.summary,
          questions: analysis.questions,
          prompt: prompt,
          nodeOptionsDetected: analysis.nodeOptionsDetected,
          hasNodeChoices: analysis.hasNodeChoices,
        });
      } catch (error) {
        console.error('Analysis error:', error);
        // Return fallback questions on error - use a simple fallback
        return res.json({
          summary: `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`,
          questions: [
            {
              id: 'q1',
              text: 'When should this workflow run?',
              options: ['Only when I trigger it manually', 'Automatically on a schedule', 'When I receive data or an event', 'I\'m not sure yet'],
              category: 'schedule',
            },
            {
              id: 'q2',
              text: 'What should happen if the workflow encounters an error?',
              options: ['Stop and notify me', 'Retry automatically', 'Continue with default values', 'Log the error and continue'],
              category: 'error_handling',
            },
            {
              id: 'q3',
              text: 'Do you have existing accounts or credentials for the services this workflow needs?',
              options: ['Yes, I have all credentials ready', 'Some credentials, but may need help', 'No credentials yet', 'Not sure what credentials are needed'],
              category: 'authentication',
            },
          ],
          prompt: prompt,
        });
      }
    }

    // Handle refine mode - Step 3 & 4: Generate system prompt and extract requirements
    if (mode === 'refine') {
      try {
        // Combine prompt with answers
        const refinedPrompt = answers && Object.keys(answers).length > 0
          ? `${prompt}\n\nUser answers: ${JSON.stringify(answers)}`
          : prompt;

        // Step 3: Generate system prompt (20-30 words) - handled by workflow builder
        // Step 4: Extract requirements using RequirementsExtractor
        const requirements = await requirementsExtractor.extractRequirements(
          prompt,
          refinedPrompt,
          answers
        );

        // Generate system prompt from refined prompt
        const systemPromptWords = refinedPrompt.split(/\s+/).slice(0, 30);
        const systemPrompt = systemPromptWords.length >= 20
          ? systemPromptWords.join(' ')
          : `${systemPromptWords.join(' ')}. Build an automated workflow to accomplish this task.`;

        return res.json({
          refinedPrompt: refinedPrompt,
          systemPrompt: systemPrompt,
          requirements: requirements,
          prompt: prompt,
        });
      } catch (error) {
        console.error('Refinement error:', error);
        return res.json({
          refinedPrompt: prompt,
          systemPrompt: `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`,
          requirements: {
            urls: [],
            apis: [],
            credentials: [],
            schedules: [],
            platforms: [],
            dataFormats: [],
            errorHandling: [],
            notifications: [],
          },
          prompt: prompt,
        });
      }
    }

    // Handle create mode - Step 5-7: Build, Validate, Output
    const streamProgress = req.headers['x-stream-progress'] === 'true';
    
    // Helper function for surgical merge in edit mode
    const performSurgicalMerge = (originalWorkflow: any, aiWorkflow: any) => {
      if (!originalWorkflow || !originalWorkflow.nodes || !Array.isArray(originalWorkflow.nodes)) {
        return aiWorkflow;
      }

      console.log('[SURGICAL MERGE] Merging AI response with original workflow to preserve existing nodes');
      
      const originalNodes = originalWorkflow.nodes || [];
      const originalEdges = originalWorkflow.edges || [];
      const aiNodes = aiWorkflow.nodes || [];
      const aiEdges = aiWorkflow.edges || [];
      
      // Create maps for quick lookup by ID
      const originalNodeMapById = new Map(originalNodes.map((n: any) => [n.id, n]));
      const aiNodeMapById = new Map(aiNodes.map((n: any) => [n.id, n]));
      
      // Also create maps by type and position for better matching when IDs differ
      const originalNodeMapByType = new Map<string, any[]>();
      originalNodes.forEach((n: any) => {
        const nodeType = n.type || n.data?.type || 'unknown';
        if (!originalNodeMapByType.has(nodeType)) {
          originalNodeMapByType.set(nodeType, []);
        }
        originalNodeMapByType.get(nodeType)!.push(n);
      });
      
      // Track which original nodes have been matched
      const matchedOriginalNodeIds = new Set<string>();
      const mergedNodes: any[] = [];
      const newNodes: any[] = [];
      
      // First pass: Match nodes by ID (exact match)
      aiNodes.forEach((aiNode: any) => {
        const originalNode: any = originalNodeMapById.get(aiNode.id);
        if (originalNode) {
          // Exact ID match - merge surgically
          matchedOriginalNodeIds.add(originalNode.id);
          const mergedNode: any = {
            ...originalNode,
            data: {
              ...(originalNode.data || {}),
              ...(aiNode.data || {}),
              config: {
                ...(originalNode.data?.config || originalNode.config || {}),
                ...(aiNode.data?.config || aiNode.config || {}),
              }
            },
            position: aiNode.position || originalNode.position,
          };
          if (aiNode.config && !aiNode.data?.config) {
            mergedNode.config = {
              ...(originalNode.config || {}),
              ...aiNode.config,
            };
          }
          mergedNodes.push(mergedNode);
        } else {
          // No exact ID match - try to match by type and position
          const nodeType = aiNode.type || aiNode.data?.type || 'unknown';
          const candidates = originalNodeMapByType.get(nodeType) || [];
          
          // Find best match by position proximity (within 100px)
          let bestMatch: any = null;
          let minDistance = Infinity;
          
          candidates.forEach((candidate: any) => {
            if (matchedOriginalNodeIds.has(candidate.id)) return; // Already matched
            
            const candidatePos = candidate.position || { x: 0, y: 0 };
            const aiPos = aiNode.position || { x: 0, y: 0 };
            const distance = Math.sqrt(
              Math.pow(candidatePos.x - aiPos.x, 2) + 
              Math.pow(candidatePos.y - aiPos.y, 2)
            );
            
            if (distance < 100 && distance < minDistance) {
              minDistance = distance;
              bestMatch = candidate;
            }
          });
          
          if (bestMatch) {
            // Found a match by type and position - merge surgically
            const matchedNode: any = bestMatch;
            matchedOriginalNodeIds.add(matchedNode.id);
            const mergedNode: any = {
              ...matchedNode,
              data: {
                ...(matchedNode.data || {}),
                ...(aiNode.data || {}),
                config: {
                  ...(matchedNode.data?.config || matchedNode.config || {}),
                  ...(aiNode.data?.config || aiNode.config || {}),
                }
              },
              position: aiNode.position || matchedNode.position,
            };
            if (aiNode.config && !aiNode.data?.config) {
              mergedNode.config = {
                ...(matchedNode.config || {}),
                ...aiNode.config,
              };
            }
            mergedNodes.push(mergedNode);
          } else {
            // No match found - this is a genuinely new node
            newNodes.push(aiNode);
          }
        }
      });
      
      // Add original nodes that weren't matched (preserve them)
      originalNodes.forEach((originalNode: any) => {
        if (!matchedOriginalNodeIds.has(originalNode.id)) {
          mergedNodes.push(originalNode);
        }
      });
      
      // Combine merged and new nodes
      const finalNodes = [...mergedNodes, ...newNodes];
      
      // Merge edges: preserve original edges, add new ones from AI
      const originalEdgeMap = new Map(originalEdges.map((e: any) => [`${e.source}-${e.target}`, e]));
      
      // Preserve original edges
      const preservedEdges = originalEdges.filter((e: any) => {
        const sourceExists = finalNodes.some((n: any) => n.id === e.source);
        const targetExists = finalNodes.some((n: any) => n.id === e.target);
        return sourceExists && targetExists;
      });
      
      // Add new edges from AI that don't exist in original
      const newEdges = aiEdges.filter((e: any) => {
        const edgeKey = `${e.source}-${e.target}`;
        return !originalEdgeMap.has(edgeKey);
      });
      
      // Replace edges that were modified in AI response
      const modifiedEdges = aiEdges.filter((e: any) => {
        const edgeKey = `${e.source}-${e.target}`;
        const originalEdge = originalEdgeMap.get(edgeKey);
        if (originalEdge) {
          return JSON.stringify(originalEdge) !== JSON.stringify(e);
        }
        return false;
      });
      
      // Remove old versions of modified edges and add new ones
      const finalEdges = [
        ...preservedEdges.filter((e: any) => {
          const edgeKey = `${e.source}-${e.target}`;
          return !modifiedEdges.some((me: any) => `${me.source}-${me.target}` === edgeKey);
        }),
        ...modifiedEdges,
        ...newEdges,
      ];
      
      const matchedCount = matchedOriginalNodeIds.size;
      const preservedCount = originalNodes.length - matchedCount;
      console.log(`[SURGICAL MERGE] Matched ${matchedCount} nodes by ID/type, preserved ${preservedCount} unchanged nodes, added ${newNodes.length} new nodes`);
      console.log(`[SURGICAL MERGE] Preserved ${preservedEdges.length} original edges, added ${newEdges.length} new edges, modified ${modifiedEdges.length} edges`);
      
      return {
        ...aiWorkflow,
        nodes: finalNodes,
        edges: finalEdges,
      };
    };
    
    try {
      if (streamProgress) {
        // Enable streaming progress updates
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendProgress = (progress: { step: number; stepName: string; progress: number; details?: any }) => {
          res.write(JSON.stringify({
            current_phase: progress.stepName.toLowerCase(),
            step: progress.step,
            step_name: progress.stepName,
            progress_percentage: progress.progress,
            details: progress.details
          }) + '\n');
        };

        try {
          const workflow = await agenticWorkflowBuilder.generateFromPrompt(
            prompt,
            {
              currentWorkflow,
              executionHistory,
              answers,
              ...req.body.config,
            },
            sendProgress
          );

          // Step 6: Validate and auto-fix workflow
          sendProgress({ step: 6, stepName: 'Validation', progress: 90, details: { message: 'Validating workflow...' } });
          const validation = await workflowValidator.validateAndFix(workflow.workflow);

          // Use fixed workflow if available
          let finalWorkflow = validation.fixedWorkflow || workflow.workflow;
          
          // Apply surgical merge in edit mode
          if (mode === 'edit' && currentWorkflow) {
            finalWorkflow = performSurgicalMerge(currentWorkflow, finalWorkflow);
          }

          // Send final result
          res.write(JSON.stringify({
            success: true,
            status: 'completed',
            nodes: finalWorkflow.nodes,
            edges: finalWorkflow.edges,
            workflow: finalWorkflow,
            documentation: workflow.documentation,
            suggestions: [...(workflow.suggestions || []), ...validation.warnings.map(w => ({ type: 'warning', message: w.message }))],
            estimatedComplexity: workflow.estimatedComplexity,
            systemPrompt: workflow.systemPrompt,
            requirements: workflow.requirements,
            requiredCredentials: workflow.requiredCredentials || [],
            validation: {
              valid: validation.valid,
              errors: validation.errors,
              warnings: validation.warnings,
              fixesApplied: validation.fixesApplied,
            },
          }) + '\n');

          res.end();
        } catch (buildError) {
          res.write(JSON.stringify({
            status: 'error',
            error: buildError instanceof Error ? buildError.message : 'Workflow generation failed'
          }) + '\n');
          res.end();
        }
      } else {
        // Non-streaming mode
        const workflow = await agenticWorkflowBuilder.generateFromPrompt(prompt, {
          currentWorkflow,
          executionHistory,
          answers,
          ...req.body.config,
        });

        // Step 6: Validate and auto-fix workflow
        const validation = await workflowValidator.validateAndFix(workflow.workflow);
        let finalWorkflow = validation.fixedWorkflow || workflow.workflow;
        
        // Apply surgical merge in edit mode
        if (mode === 'edit' && currentWorkflow) {
          finalWorkflow = performSurgicalMerge(currentWorkflow, finalWorkflow);
        }

        return res.json({
          success: true,
          workflow: finalWorkflow,
          documentation: workflow.documentation,
          suggestions: [...(workflow.suggestions || []), ...validation.warnings.map(w => ({ type: 'warning', message: w.message }))],
          estimatedComplexity: workflow.estimatedComplexity,
          systemPrompt: workflow.systemPrompt,
          requirements: workflow.requirements,
          requiredCredentials: workflow.requiredCredentials || [],
          validation: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            fixesApplied: validation.fixesApplied,
          },
        });
      }
    } catch (error) {
      console.error('Workflow generation error:', error);
      
      // Fallback: return basic workflow structure
      const basicWorkflow = {
        name: "Generated Workflow",
        summary: prompt.substring(0, 200),
        nodes: [
          {
            id: "trigger_1",
            type: "manual_trigger",
            position: { x: 250, y: 100 },
            data: {
              type: "manual_trigger",
              label: "Start",
              config: {}
            }
          },
          {
            id: "node_1",
            type: "set_variable",
            position: { x: 550, y: 100 },
            data: {
              type: "set_variable",
              label: "Process Data",
              config: {
                variables: []
              }
            }
          }
        ],
        edges: [
          {
            id: "e1",
            source: "trigger_1",
            target: "node_1"
          }
        ]
      };

      return res.json({
        success: true,
        workflow: basicWorkflow,
        message: "Workflow generated successfully. Note: This is a simplified version.",
      });
    }
  } catch (error) {
    console.error('Generate workflow error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to generate workflow. Please try again or check the logs.'
    });
  }
}
