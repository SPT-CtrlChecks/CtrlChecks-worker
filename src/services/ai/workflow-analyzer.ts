// Workflow Analyzer Service
// Step 2: Question Generation using Llama 3.1:8B
// Enhanced prompts based on comprehensive guide

import { ollamaOrchestrator } from './ollama-orchestrator';

export interface AnalysisResult {
  summary: string; // 20-30 word summary
  questions: Question[];
  intent?: string;
  entities?: string[];
  implicitRequirements?: string[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  category: QuestionCategory;
}

export type QuestionCategory = 
  | 'content'
  | 'schedule'
  | 'authentication'
  | 'destination'
  | 'error_handling'
  | 'data_source'
  | 'preferences'
  | 'other';

/**
 * WorkflowAnalyzer - Step 2: Question Generation
 * 
 * Uses Llama 3.1:8B to analyze user prompts and generate clarifying questions.
 * Follows strict rules:
 * - NEVER ask about technical implementation
 * - ALWAYS ask about business requirements
 * - Generate 3-5 relevant questions with multiple choice options
 */
export class WorkflowAnalyzer {
  private readonly model = 'llama3.1:8b';

  /**
   * Analyze user prompt and generate clarifying questions
   */
  async analyzePrompt(
    userPrompt: string,
    context?: {
      existingWorkflow?: any;
      userHistory?: any[];
    }
  ): Promise<AnalysisResult> {
    console.log(`🔍 Analyzing prompt: "${userPrompt}"`);

    const systemPrompt = this.buildSystemPrompt();
    const analysisPrompt = this.buildAnalysisPrompt(userPrompt, context);

    try {
      const response = await ollamaOrchestrator.processRequest(
        'workflow-analysis',
        {
          system: systemPrompt,
          message: analysisPrompt,
        },
        {
          temperature: 0.7,
          max_tokens: 2000,
          cache: false,
        }
      );

      return this.parseAnalysisResponse(response, userPrompt);
    } catch (error) {
      console.error('❌ Error analyzing prompt:', error);
      // Return fallback questions
      return this.generateFallbackQuestions(userPrompt);
    }
  }

  /**
   * Build system prompt with strict rules
   */
  private buildSystemPrompt(): string {
    return `You are an expert Autonomous Workflow Agent v2.5. Your role is to analyze user workflow requests and generate clarifying questions that help you understand business requirements.

CRITICAL RULES - YOU MUST FOLLOW THESE:

1. AUTONOMY PRINCIPLE:
   - You are fully autonomous in workflow creation
   - NEVER ask users about technical implementation details
   - NEVER ask which nodes to use (you decide this)
   - NEVER ask about workflow structure (you design this)
   - ALWAYS ask about business requirements and missing information

2. QUESTION QUALITY:
   - Questions must be clear, specific, and actionable
   - Each question should have 3-4 multiple choice options
   - Options should cover common scenarios
   - Questions should be in non-technical language
   - Focus on WHAT the user wants, not HOW to implement it

3. QUESTION CATEGORIES:
   - Content: What data/content should be processed?
   - Schedule: When/how often should this run?
   - Authentication: Do you have credentials for services?
   - Destination: Where should results go?
   - Error Handling: How should errors be handled?
   - Data Source: Where is data coming from?
   - Preferences: Any specific requirements?

4. ANTI-PATTERNS (NEVER DO THESE):
   ❌ "Which node type should we use?"
   ❌ "What API endpoint should we call?"
   ❌ "How should we structure the workflow?"
   ❌ "Which database should we use?" (unless user hasn't specified)
   ✅ "What content should be posted?"
   ✅ "When should this run?"
   ✅ "Do you have Twitter API credentials?"

5. OUTPUT FORMAT:
   - Generate exactly 3-5 questions
   - Each question must have unique ID (q1, q2, q3, etc.)
   - Summary must be 20-30 words exactly
   - Questions must be in JSON format

Remember: You are an intelligent agent. Ask about business needs, not technical details.`;
  }

  /**
   * Build analysis prompt with user input
   */
  private buildAnalysisPrompt(
    userPrompt: string,
    context?: {
      existingWorkflow?: any;
      userHistory?: any[];
    }
  ): string {
    let prompt = `Analyze this workflow request and generate clarifying questions:

User Request: "${userPrompt}"

`;

    // Add context if available
    if (context?.existingWorkflow) {
      prompt += `Context: User is modifying an existing workflow.\n\n`;
    }

    if (context?.userHistory && context.userHistory.length > 0) {
      prompt += `User History: User has created ${context.userHistory.length} workflow(s) before.\n\n`;
    }

    prompt += `Generate 3-5 clarifying questions following these guidelines:

1. Identify missing business requirements:
   - What data/content needs to be processed?
   - What are the scheduling preferences?
   - What are the authentication requirements?
   - Where should results be sent/stored?

2. Identify uncertainties:
   - Ambiguous time references (convert to specific times)
   - Unclear data sources or destinations
   - Missing configuration details
   - Edge cases or error handling preferences

3. Extract implicit requirements:
   - Error handling needs (if user mentions "reliable", "important")
   - Logging needs (if user mentions "audit", "track")
   - Notification needs (if user mentions "alert", "notify")

4. Question Format:
   - Each question should be specific and actionable
   - Provide 3-4 multiple choice options
   - Options should represent different scenarios or preferences
   - Question text should ONLY contain the question (no option letters)

Example of CORRECT format:
{
  "summary": "Automated daily Twitter posting workflow with scheduled content delivery at specified time",
  "questions": [
    {
      "id": "q1",
      "text": "What time should the post be sent?",
      "options": ["9 AM", "12 PM", "6 PM", "Custom time"],
      "category": "schedule"
    },
    {
      "id": "q2",
      "text": "What content should be posted?",
      "options": ["Static text message", "Dynamic content from API", "User-provided content", "Random from collection"],
      "category": "content"
    },
    {
      "id": "q3",
      "text": "Do you have Twitter API credentials configured?",
      "options": ["Yes, I have credentials", "No, I need help setting up", "I'll provide them later"],
      "category": "authentication"
    }
  ]
}

Example of INCORRECT format (DO NOT DO THIS):
{
  "text": "Which node type should we use for posting? (A) HTTP Request, (B) Twitter API, (C) Webhook",
  "options": ["A", "B", "C"]
}

Return ONLY valid JSON in this format:
{
  "summary": "20-30 word summary of what you understood",
  "questions": [
    {
      "id": "q1",
      "text": "Question about business requirement?",
      "options": ["Option 1", "Option 2", "Option 3"],
      "category": "content|schedule|authentication|destination|error_handling|data_source|preferences|other"
    }
  ],
  "intent": "dataSync|notification|transformation|apiIntegration|scheduledTask",
  "entities": ["entity1", "entity2"],
  "implicitRequirements": ["requirement1", "requirement2"]
}`;

    return prompt;
  }

  /**
   * Parse AI response into AnalysisResult
   */
  private parseAnalysisResponse(response: any, userPrompt: string): AnalysisResult {
    try {
      // Extract JSON from response
      let content = typeof response === 'string' ? response : response.content || JSON.stringify(response);
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      } else {
        // Try to find JSON object in the response
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          content = jsonObjectMatch[0];
        }
      }

      const parsed = JSON.parse(content);

      // Validate and normalize
      const result: AnalysisResult = {
        summary: this.normalizeSummary(parsed.summary || this.generateFallbackSummary(userPrompt)),
        questions: this.normalizeQuestions(parsed.questions || []),
        intent: parsed.intent,
        entities: parsed.entities || [],
        implicitRequirements: parsed.implicitRequirements || [],
      };

      // Ensure we have at least 3 questions
      if (result.questions.length < 3) {
        const fallback = this.generateFallbackQuestions(userPrompt);
        result.questions = [...result.questions, ...fallback.questions.slice(result.questions.length)];
      }

      return result;
    } catch (error) {
      console.error('❌ Error parsing analysis response:', error);
      return this.generateFallbackQuestions(userPrompt);
    }
  }

  /**
   * Normalize summary to 20-30 words
   */
  private normalizeSummary(summary: string): string {
    const words = summary.trim().split(/\s+/);
    if (words.length >= 20 && words.length <= 30) {
      return summary.trim();
    }
    
    // Adjust to 20-30 words
    if (words.length < 20) {
      // Add context if too short
      return summary.trim() + ' workflow automation with error handling and validation.';
    } else {
      // Trim if too long
      return words.slice(0, 30).join(' ') + '.';
    }
  }

  /**
   * Normalize questions array
   */
  private normalizeQuestions(questions: any[]): Question[] {
    return questions
      .slice(0, 5) // Max 5 questions
      .map((q, index) => ({
        id: q.id || `q${index + 1}`,
        text: this.cleanQuestionText(q.text || q.question || ''),
        options: this.normalizeOptions(q.options || []),
        category: this.normalizeCategory(q.category),
      }))
      .filter(q => q.text.length > 0 && q.options.length >= 2);
  }

  /**
   * Clean question text (remove option letters, etc.)
   */
  private cleanQuestionText(text: string): string {
    // Remove option letters like "(A)", "(B)", etc.
    return text
      .replace(/\([A-D]\)\s*/g, '')
      .replace(/^[A-D]\.\s*/g, '')
      .trim();
  }

  /**
   * Normalize options array
   */
  private normalizeOptions(options: any[]): string[] {
    return options
      .slice(0, 4) // Max 4 options
      .map(opt => {
        const text = typeof opt === 'string' ? opt : opt.text || opt.label || String(opt);
        // Remove option letters
        return text.replace(/^[A-D][\.\)]\s*/, '').trim();
      })
      .filter(opt => opt.length > 0);
  }

  /**
   * Normalize category
   */
  private normalizeCategory(category: any): QuestionCategory {
    const validCategories: QuestionCategory[] = [
      'content',
      'schedule',
      'authentication',
      'destination',
      'error_handling',
      'data_source',
      'preferences',
      'other',
    ];
    
    if (typeof category === 'string' && validCategories.includes(category as QuestionCategory)) {
      return category as QuestionCategory;
    }
    
    return 'other';
  }

  /**
   * Generate fallback questions if AI fails
   */
  private generateFallbackQuestions(userPrompt: string): AnalysisResult {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Detect intent
    let questions: Question[] = [];
    
    if (lowerPrompt.includes('sync') || lowerPrompt.includes('copy') || lowerPrompt.includes('import')) {
      questions = [
        {
          id: 'q1',
          text: 'What is the source system or data location?',
          options: ['API endpoint', 'Database', 'File/Spreadsheet', 'Another service'],
          category: 'data_source' as QuestionCategory,
        },
        {
          id: 'q2',
          text: 'What is the destination system?',
          options: ['Database', 'API endpoint', 'File/Spreadsheet', 'Another service'],
          category: 'destination' as QuestionCategory,
        },
        {
          id: 'q3',
          text: 'How often should the sync run?',
          options: ['Daily', 'Hourly', 'Weekly', 'On demand'],
          category: 'schedule' as QuestionCategory,
        },
      ];
    } else if (lowerPrompt.includes('notify') || lowerPrompt.includes('alert') || lowerPrompt.includes('send')) {
      questions = [
        {
          id: 'q1',
          text: 'What should trigger the notification?',
          options: ['Specific event', 'Scheduled time', 'Error condition', 'Data change'],
          category: 'content' as QuestionCategory,
        },
        {
          id: 'q2',
          text: 'Where should the notification be sent?',
          options: ['Email', 'Slack', 'SMS', 'Multiple channels'],
          category: 'destination' as QuestionCategory,
        },
        {
          id: 'q3',
          text: 'What information should the notification include?',
          options: ['Basic status', 'Detailed data', 'Error details', 'Custom message'],
          category: 'content' as QuestionCategory,
        },
      ];
    } else {
      // Generic questions
      questions = [
        {
          id: 'q1',
          text: 'What is the primary goal of this workflow?',
          options: ['Automate a task', 'Process data', 'Send notifications', 'Integrate services'],
          category: 'content' as QuestionCategory,
        },
        {
          id: 'q2',
          text: 'When should this workflow run?',
          options: ['On schedule', 'On event trigger', 'Manually', 'Continuously'],
          category: 'schedule' as QuestionCategory,
        },
        {
          id: 'q3',
          text: 'Do you have the necessary credentials configured?',
          options: ['Yes, all configured', 'Some need setup', 'Need help', 'Not sure'],
          category: 'authentication' as QuestionCategory,
        },
      ];
    }

    return {
      summary: this.generateFallbackSummary(userPrompt),
      questions,
      intent: 'other',
      entities: [],
      implicitRequirements: [],
    };
  }

  /**
   * Generate fallback summary
   */
  private generateFallbackSummary(userPrompt: string): string {
    const words = userPrompt.split(/\s+/).slice(0, 25);
    return words.join(' ') + ' workflow automation with error handling and validation.';
  }
}

// Export singleton instance
export const workflowAnalyzer = new WorkflowAnalyzer();
