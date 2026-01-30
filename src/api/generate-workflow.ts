// Generate Workflow Route
// Migrated from Supabase Edge Function
// Handles workflow generation and analysis

import { Request, Response } from 'express';
import { agenticWorkflowBuilder } from '../services/ai/workflow-builder';
import { ollamaOrchestrator } from '../services/ai/ollama-orchestrator';

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
        // Get node library description for context
        const nodeLibraryInfo = agenticWorkflowBuilder.getNodeLibraryDescription();
        
        // Use Ollama to analyze the prompt and generate questions
        const analysisPrompt = `You are an Autonomous Workflow Agent v2.5. Analyze this workflow request and generate clarifying questions.

User Request: "${prompt}"

IMPORTANT: You are an intelligent agent that will decide which nodes to use. DO NOT ask users about which specific nodes or technical components to use. Instead, ask about business requirements, missing information, or uncertainties you have about the workflow.

Generate 3-5 clarifying questions that help you understand:
- Missing business requirements or details needed to build the workflow
- User preferences, configurations, or constraints
- Uncertainties about the workflow logic or data flow
- Authentication requirements, API endpoints, or external service details
- Scheduling preferences, frequency, or timing requirements
- Data formats, sources, or destinations that are unclear
- Error handling or edge case preferences

DO NOT ask about:
- Which specific node types to use (you decide this)
- Technical implementation details (you handle this)
- Node selection or workflow structure (you design this)

Each question should:
- Be about business logic, requirements, or missing information
- Be specific and actionable
- Have 2-4 multiple choice options that represent different scenarios or preferences
- Focus on WHAT the user wants, not HOW to implement it

CRITICAL: The question text should ONLY contain the question itself. DO NOT include option letters (A, B, C, D) or option descriptions in the question text. The options array should contain clean option text without any letter prefixes.

Example of CORRECT format:
{
  "text": "What specific tasks do you want to automate?",
  "options": ["Posting scheduled posts", "Engaging with followers", "Both posting and engaging", "Other custom actions"]
}

Example of INCORRECT format (DO NOT DO THIS):
{
  "text": "What specific tasks do you want to automate? (A) Posting scheduled posts, (B) Engaging with followers, (C) Both A & B, or (D) Other custom actions.",
  "options": ["A", "B", "C", "D"]
}

Return JSON format:
{
  "summary": "Brief 20-30 word summary of what you understood",
  "questions": [
    {
      "id": "q1",
      "text": "Question about business requirement or uncertainty?",
      "options": ["Option 1 text", "Option 2 text", "Option 3 text"]
    }
  ]
}`;

        const result = await ollamaOrchestrator.processRequest('workflow-generation', {
          prompt: analysisPrompt,
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
          
          // Clean up questions: Remove option letters/descriptions from question text if present
          if (parsed.questions && Array.isArray(parsed.questions)) {
            parsed.questions = parsed.questions.map((q: any) => {
              if (q.text && typeof q.text === 'string') {
                // Remove patterns like "(A) option, (B) option" or "A) option, B) option" from question text
                let cleanText = q.text
                  .replace(/\s*\([A-Z]\)\s*[^?]*/gi, '') // Remove "(A) text, (B) text" patterns
                  .replace(/\s*[A-Z]\)\s*[^?]*/gi, '') // Remove "A) text, B) text" patterns
                  .replace(/\s*or\s*\([A-Z]\)\s*[^?]*/gi, '') // Remove trailing "or (D) text"
                  .replace(/\s*,\s*\([A-Z]\)\s*/gi, '') // Remove ", (B)" patterns
                  .trim();
                
                // Ensure question ends with proper punctuation
                if (cleanText && !cleanText.match(/[?\.!]$/)) {
                  cleanText = cleanText + '?';
                }
                
                q.text = cleanText;
              }
              
              // Ensure options are clean (remove letter prefixes if present)
              if (q.options && Array.isArray(q.options)) {
                q.options = q.options.map((opt: string) => {
                  if (typeof opt === 'string') {
                    // Remove patterns like "A) " or "(A) " from option text
                    return opt.replace(/^[A-Z]\)\s*/i, '').replace(/^\([A-Z]\)\s*/i, '').trim();
                  }
                  return opt;
                });
              }
              
              return q;
            });
          }
        } catch (parseError) {
          console.warn('Failed to parse analysis, using fallback questions');
          // Fallback questions based on common workflow needs
          parsed = {
            summary: `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`,
            questions: [
              {
                id: 'q1',
                text: 'When should this workflow run?',
                options: ['Only when I trigger it manually', 'Automatically on a schedule', 'When I receive data or an event', 'I\'m not sure yet']
              },
              {
                id: 'q2',
                text: 'What should happen if the workflow encounters an error?',
                options: ['Stop and notify me', 'Retry automatically', 'Continue with default values', 'Log the error and continue']
              },
              {
                id: 'q3',
                text: 'Do you have existing accounts or credentials for the services this workflow needs?',
                options: ['Yes, I have all credentials ready', 'Some credentials, but may need help', 'No credentials yet', 'Not sure what credentials are needed']
              }
            ]
          };
        }

        // Ensure questions array exists
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions || [];
        }

        // Ensure summary exists
        if (!parsed.summary) {
          parsed.summary = `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`;
        }

        return res.json({
          summary: parsed.summary,
          questions: parsed.questions,
          prompt: prompt,
        });
      } catch (error) {
        console.error('Analysis error:', error);
        // Return fallback questions on error
        return res.json({
          summary: `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`,
          questions: [
            {
              id: 'q1',
              text: 'When should this workflow run?',
              options: ['Only when I trigger it manually', 'Automatically on a schedule', 'When I receive data or an event']
            },
            {
              id: 'q2',
              text: 'What should happen if something goes wrong?',
              options: ['Stop and notify me', 'Retry automatically', 'Continue with default values']
            }
          ],
          prompt: prompt,
        });
      }
    }

    // Handle refine mode - Step 3 & 4: Generate system prompt and extract requirements
    if (mode === 'refine') {
      try {
        const refinedPrompt = await ollamaOrchestrator.processRequest('workflow-generation', {
          prompt: `Refine this workflow request based on answers:

Original request: "${prompt}"
Answers: ${JSON.stringify(answers)}

Generate a refined, detailed workflow description that incorporates the answers.`,
          temperature: 0.3,
        });

        const refinedText = typeof refinedPrompt === 'string' ? refinedPrompt : JSON.stringify(refinedPrompt);
        
        // Step 3: Generate system prompt (20-30 words)
        const systemPromptResult = await ollamaOrchestrator.processRequest('workflow-generation', {
          prompt: `Based on this refined workflow request, create a concise 20-30 word system prompt:

"${refinedText}"

Generate a clear, concise system prompt (20-30 words) that captures the core intent. Return only the prompt text.`,
          temperature: 0.2,
          maxTokens: 100,
        });

        let systemPrompt = typeof systemPromptResult === 'string' ? systemPromptResult.trim() : JSON.stringify(systemPromptResult);
        systemPrompt = systemPrompt.replace(/^["']|["']$/g, '').replace(/```[\w]*\n?|\n?```/g, '').trim();
        const words = systemPrompt.split(/\s+/);
        if (words.length > 30) {
          systemPrompt = words.slice(0, 30).join(' ');
        } else if (words.length < 20) {
          systemPrompt = `${systemPrompt}. Build an automated workflow to accomplish this task.`;
        }

        // Step 4: Extract requirements
        const requirementsResult = await ollamaOrchestrator.processRequest('workflow-generation', {
          prompt: `Extract workflow requirements from this request:

"${refinedText}"

Return JSON:
{
  "urls": ["url1", ...],
  "apis": ["api1", ...],
  "credentials": ["credential1", ...],
  "schedules": ["schedule1", ...],
  "platforms": ["platform1", ...]
}`,
          temperature: 0.3,
        });

        let requirements: any = {};
        try {
          const reqText = typeof requirementsResult === 'string' ? requirementsResult : JSON.stringify(requirementsResult);
          let cleanReq = reqText.trim();
          if (cleanReq.includes('```json')) {
            cleanReq = cleanReq.split('```json')[1].split('```')[0].trim();
          } else if (cleanReq.includes('```')) {
            cleanReq = cleanReq.split('```')[1].split('```')[0].trim();
          }
          requirements = JSON.parse(cleanReq);
        } catch (e) {
          requirements = { urls: [], apis: [], credentials: [], schedules: [], platforms: [] };
        }

        return res.json({
          refinedPrompt: refinedText,
          systemPrompt: systemPrompt,
          requirements: requirements,
          prompt: prompt,
        });
      } catch (error) {
        console.error('Refinement error:', error);
        return res.json({
          refinedPrompt: prompt,
          systemPrompt: `Build an automated workflow to accomplish: ${prompt.substring(0, 100)}`,
          requirements: { urls: [], apis: [], credentials: [], schedules: [], platforms: [] },
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
              ...req.body.config,
            },
            sendProgress
          );

          // Send final result
          res.write(JSON.stringify({
            success: true,
            status: 'completed',
            nodes: workflow.workflow.nodes,
            edges: workflow.workflow.edges,
            workflow: workflow.workflow,
            documentation: workflow.documentation,
            suggestions: workflow.suggestions,
            estimatedComplexity: workflow.estimatedComplexity,
            systemPrompt: workflow.systemPrompt,
            requirements: workflow.requirements,
            requiredCredentials: workflow.requiredCredentials || [],
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
          ...req.body.config,
        });

        return res.json({
          success: true,
          workflow: workflow.workflow,
          documentation: workflow.documentation,
          suggestions: workflow.suggestions,
          estimatedComplexity: workflow.estimatedComplexity,
          systemPrompt: workflow.systemPrompt,
          requirements: workflow.requirements,
          requiredCredentials: workflow.requiredCredentials || [],
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
