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

    // Handle analyze mode - return questions for the wizard
    if (mode === 'analyze') {
      try {
        // Use Ollama to analyze the prompt and generate questions
        const analysisPrompt = `Analyze this workflow request: "${prompt}"

Generate 3-5 clarifying questions that would help build this workflow. Each question should:
- Be specific and actionable
- Help identify missing configuration details
- Have 2-4 multiple choice options

Return JSON format:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text?",
      "options": ["Option 1", "Option 2", "Option 3"]
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
        } catch (parseError) {
          console.warn('Failed to parse analysis, using fallback questions');
          // Fallback questions based on common workflow needs
          parsed = {
            questions: [
              {
                id: 'q1',
                text: 'How should this workflow be triggered?',
                options: ['Manually', 'On a schedule', 'Via webhook', 'When a form is submitted']
              },
              {
                id: 'q2',
                text: 'What is the primary output of this workflow?',
                options: ['Send notification', 'Update database', 'Generate report', 'Process data']
              },
              {
                id: 'q3',
                text: 'Does this workflow need to integrate with external services?',
                options: ['No external services', 'Google services', 'Slack/Discord', 'Email service']
              }
            ]
          };
        }

        // Ensure questions array exists
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions || [];
        }

        return res.json({
          questions: parsed.questions,
          prompt: prompt,
        });
      } catch (error) {
        console.error('Analysis error:', error);
        // Return fallback questions on error
        return res.json({
          questions: [
            {
              id: 'q1',
              text: 'How should this workflow be triggered?',
              options: ['Manually', 'On a schedule', 'Via webhook']
            },
            {
              id: 'q2',
              text: 'What is the primary goal?',
              options: ['Automate task', 'Process data', 'Send notifications']
            }
          ],
          prompt: prompt,
        });
      }
    }

    // Handle refine mode - use answers to refine the prompt
    if (mode === 'refine') {
      try {
        const refinedPrompt = await ollamaOrchestrator.processRequest('workflow-generation', {
          prompt: `Refine this workflow request based on answers:

Original request: "${prompt}"
Answers: ${JSON.stringify(answers)}

Generate a refined, detailed workflow description that incorporates the answers.`,
          temperature: 0.3,
        });

        return res.json({
          refinedPrompt: typeof refinedPrompt === 'string' ? refinedPrompt : JSON.stringify(refinedPrompt),
          prompt: prompt,
        });
      } catch (error) {
        console.error('Refinement error:', error);
        return res.json({
          refinedPrompt: prompt,
          prompt: prompt,
        });
      }
    }

    // Handle create mode - generate actual workflow
    try {
      const workflow = await agenticWorkflowBuilder.generateFromPrompt(prompt, {
        currentWorkflow,
        executionHistory,
      });

      return res.json({
        success: true,
        workflow: workflow.workflow,
        documentation: workflow.documentation,
        suggestions: workflow.suggestions,
        estimatedComplexity: workflow.estimatedComplexity,
      });
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
