// Generate Workflow Route
// Migrated from Supabase Edge Function
// Handles workflow generation and analysis

import { Request, Response } from 'express';
import { agenticWorkflowBuilder } from '../services/ai/workflow-builder';
import { workflowAnalyzer } from '../services/ai/workflow-analyzer';
import { enhancedWorkflowAnalyzer } from '../services/ai/enhanced-workflow-analyzer';
import { requirementsExtractor } from '../services/ai/requirements-extractor';
import { workflowValidator } from '../services/ai/workflow-validator';
import { ExtractedRequirements } from '../services/ai/requirements-extractor';

/**
 * Identify required credentials from requirements and answers
 * This is used in the refine step to determine which credentials will be needed
 */
function identifyRequiredCredentialsFromRequirements(
  requirements: ExtractedRequirements,
  userPrompt: string,
  answers?: Record<string, string>
): string[] {
  const credentials: string[] = [];
  const promptLower = userPrompt.toLowerCase();
  const answerValues = answers ? Object.values(answers).map(v => String(v).toLowerCase()) : [];
  const answerTexts = answers ? Object.values(answers).join(' ').toLowerCase() : '';
  
  console.log('🔍 [Backend] Identifying credentials:', { 
    promptLower: promptLower.substring(0, 100), 
    answerValues, 
    answerTexts: answerTexts.substring(0, 200) 
  });
  
  // Check if AI Agent/LLM functionality is needed
  const hasAIFunctionality = 
    promptLower.includes('ai agent') ||
    promptLower.includes('ai assistant') ||
    promptLower.includes('chatbot') ||
    promptLower.includes('chat bot') ||
    promptLower.includes('llm') ||
    promptLower.includes('language model') ||
    promptLower.includes('generate') ||
    promptLower.includes('analyze') ||
    promptLower.includes('summarize') ||
    promptLower.includes('classify') ||
    promptLower.includes('sentiment') ||
    promptLower.includes('intent') ||
    promptLower.includes('natural language') ||
    promptLower.includes('nlp') ||
    promptLower.includes('text analysis') ||
    promptLower.includes('content generation') ||
    promptLower.includes('ai-powered') ||
    promptLower.includes('ai powered') ||
    promptLower.includes('using ai') ||
    promptLower.includes('with ai') ||
    promptLower.includes('ai model') ||
    answerTexts.includes('ai agent') ||
    answerTexts.includes('ai assistant') ||
    answerTexts.includes('chatbot') ||
    answerTexts.includes('ai-generated') ||
    answerTexts.includes('ai generated') ||
    answerTexts.includes('ai-generated content') ||
    answerTexts.includes('ai content') ||
    answerValues.some(v => v.includes('ai-generated') || v.includes('ai generated'));
  
  console.log('🤖 [Backend] AI Functionality detected:', hasAIFunctionality);
  
  // Check for AI providers in answers
  if (answerValues.some(v => v.includes('openai') || v.includes('gpt'))) {
    credentials.push('OPENAI_API_KEY');
    console.log('✅ [Backend] Added OPENAI_API_KEY');
  } else if (answerValues.some(v => v.includes('claude') || v.includes('anthropic'))) {
    credentials.push('ANTHROPIC_API_KEY');
    console.log('✅ [Backend] Added ANTHROPIC_API_KEY');
  } else if (answerValues.some(v => v.includes('gemini') || v.includes('google'))) {
    credentials.push('GEMINI_API_KEY');
    console.log('✅ [Backend] Added GEMINI_API_KEY (from provider selection)');
  } else if (hasAIFunctionality) {
    // If AI functionality is detected but no specific provider selected, default to Gemini
    credentials.push('GEMINI_API_KEY');
    console.log('✅ [Backend] Added GEMINI_API_KEY (default for AI functionality)');
  }
  
  // Check requirements.credentials array
  if (requirements.credentials && Array.isArray(requirements.credentials)) {
    requirements.credentials.forEach((cred: any) => {
      const credName = typeof cred === 'string' ? cred : (cred.name || cred.type || '');
      if (credName && !credentials.includes(credName.toUpperCase())) {
        credentials.push(credName.toUpperCase());
      }
    });
  }
  
  // Check requirements.apis array
  if (requirements.apis && Array.isArray(requirements.apis)) {
    requirements.apis.forEach((api: any) => {
      const apiName = typeof api === 'string' ? api : (api.name || api.endpoint || '');
      const apiLower = apiName.toLowerCase();
      if (apiLower.includes('openai') || apiLower.includes('gpt')) {
        if (!credentials.includes('OPENAI_API_KEY')) credentials.push('OPENAI_API_KEY');
      } else if (apiLower.includes('claude') || apiLower.includes('anthropic')) {
        if (!credentials.includes('ANTHROPIC_API_KEY')) credentials.push('ANTHROPIC_API_KEY');
      } else if (apiLower.includes('gemini') || apiLower.includes('google')) {
        if (!credentials.includes('GEMINI_API_KEY')) credentials.push('GEMINI_API_KEY');
      }
    });
  }
  
  // Check for platforms that might need credentials
  if (requirements.platforms && Array.isArray(requirements.platforms)) {
    requirements.platforms.forEach((platform: any) => {
      const platformName = typeof platform === 'string' ? platform : (platform.name || platform.type || '');
      const platformLower = platformName.toLowerCase();
      if (platformLower.includes('slack')) {
        if (!credentials.includes('SLACK_TOKEN')) credentials.push('SLACK_TOKEN');
      } else if (platformLower.includes('discord')) {
        if (!credentials.includes('DISCORD_WEBHOOK_URL')) credentials.push('DISCORD_WEBHOOK_URL');
      } else if (platformLower.includes('google') && (platformLower.includes('sheet') || platformLower.includes('gmail') || platformLower.includes('drive'))) {
        if (!credentials.includes('GOOGLE_OAUTH_CLIENT_ID')) credentials.push('GOOGLE_OAUTH_CLIENT_ID');
        if (!credentials.includes('GOOGLE_OAUTH_CLIENT_SECRET')) credentials.push('GOOGLE_OAUTH_CLIENT_SECRET');
      }
    });
  }
  
  const finalCredentials = [...new Set(credentials)]; // Remove duplicates
  console.log('🎯 [Backend] Final identified credentials:', finalCredentials);
  return finalCredentials;
}

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
              options: ['Fixed Schedule', 'Regular Intervals', 'Event Trigger', 'Manual Run'],
              category: 'schedule',
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

        // Identify required credentials based on requirements and answers
        const requiredCredentials = identifyRequiredCredentialsFromRequirements(requirements, prompt, answers);
        
        console.log('🔑 [Backend] Refine mode - Identified required credentials:', requiredCredentials);
        console.log('📋 [Backend] Requirements:', JSON.stringify(requirements, null, 2));
        console.log('💬 [Backend] Answers:', JSON.stringify(answers, null, 2));
        console.log('📝 [Backend] Prompt:', prompt.substring(0, 200));

        return res.json({
          refinedPrompt: refinedPrompt,
          systemPrompt: systemPrompt,
          requirements: requirements,
          requiredCredentials: requiredCredentials, // Add required credentials to response
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
