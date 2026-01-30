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
          const finalWorkflow = validation.fixedWorkflow || workflow.workflow;

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
        const finalWorkflow = validation.fixedWorkflow || workflow.workflow;

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
