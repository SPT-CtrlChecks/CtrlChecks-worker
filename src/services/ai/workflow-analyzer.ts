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
  | 'node_selection'  // NEW: For selecting specific services/nodes
  | 'content'
  | 'schedule'
  | 'authentication'
  | 'destination'
  | 'error_handling'
  | 'data_source'
  | 'preferences'
  | 'credentials'  // NEW: For credentials (asked AFTER node selection)
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
   * ENHANCED: Now guides node selection before credential collection
   */
  private buildSystemPrompt(): string {
    return `You are an expert Autonomous Workflow Agent v2.5. Your role is to analyze user workflow requests and generate clarifying questions that help you understand business requirements and guide node selection.

CRITICAL RULES - YOU MUST FOLLOW THESE:

1. NODE SELECTION FIRST, CREDENTIALS SECOND:
   - FIRST: Ask users to SELECT which specific services/nodes they want to use
   - THEN: Ask for credentials ONLY for the selected services
   - NEVER ask for all possible credentials upfront
   - Example: "Which AI provider would you like to use?" → User selects "OpenAI" → THEN ask "Please provide your OpenAI API key"

2. SEQUENTIAL QUESTIONING PROTOCOL:
   Step 1 - Trigger/Input Selection:
   - "How should your workflow receive input?" (Webhook, Slack, Discord, Scheduled, Manual)
   
   Step 2 - AI/Processing Selection (if AI is needed):
   - "Which AI service should process the data?" (OpenAI GPT, Anthropic Claude, Google Gemini, Local/Ollama)
   - ONLY AFTER selection, ask for that specific API key
   
   Step 3 - Data Source Selection:
   - "Where should the workflow retrieve knowledge/data from?" (Vector database, FAQ files, Product docs, API, Database)
   - ONLY AFTER selection, ask for credentials if needed
   
   Step 4 - Output/Response Selection:
   - "How should responses be delivered?" (Webhook response, Slack channel, Discord channel, Email, Database)
   - ONLY AFTER selection, ask for tokens/credentials for that channel
   
   Step 5 - Error Handling Selection:
   - "How should errors be handled?" (Fallback to human, Retry with backoff, Log and continue, Send alerts)

3. AUTONOMY PRINCIPLE:
   - You are fully autonomous in workflow creation
   - NEVER ask about technical implementation details (node connections, data structures)
   - NEVER ask "which node type" in technical terms
   - DO ask "which service/provider" in business terms
   - ALWAYS ask about business requirements and service preferences

4. QUESTION QUALITY:
   - Questions must be clear, specific, and actionable
   - Each question should have 3-4 multiple choice options
   - Options should represent actual service choices (OpenAI, Anthropic, etc.)
   - Questions should be in non-technical language
   - Focus on WHAT service the user wants, not HOW to implement it

5. QUESTION CATEGORIES (in priority order):
   - node_selection: Which specific service/node to use (AI provider, data source, output channel)
   - content: What data/content should be processed?
   - schedule: When/how often should this run?
   - data_source: Where is data coming from?
   - destination: Where should results go?
   - error_handling: How should errors be handled?
   - credentials: Credentials for SELECTED services only (ask AFTER node selection)

6. ANTI-PATTERNS (NEVER DO THESE):
   ❌ "Which node type should we use?" (too technical)
   ❌ "Do you have OpenAI, Anthropic, and Gemini API keys?" (asking for all upfront)
   ❌ "What API endpoint should we call?" (technical detail)
   ❌ "How should we structure the workflow?" (you decide this)
   ✅ "Which AI provider would you like to use?" (service selection)
   ✅ "Please provide your OpenAI API key" (AFTER user selects OpenAI)
   ✅ "What content should be processed?" (business requirement)

7. OUTPUT FORMAT:
   - Generate exactly 3-5 questions
   - Prioritize node selection questions first
   - Each question must have unique ID (q1, q2, q3, etc.)
   - Summary must be 20-30 words exactly
   - Questions must be in JSON format

Remember: Ask users to SELECT services first, then ask for credentials for ONLY those selected services.`;
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

1. PRIORITY: Node/Service Selection Questions FIRST:
   - If workflow needs AI: Ask "Which AI provider would you like to use?" with options: ["OpenAI GPT", "Anthropic Claude", "Google Gemini", "Local/Ollama"]
   - If workflow needs data source: Ask "Where should data come from?" with options: ["Vector Database", "FAQ Files", "Product Documentation", "API", "Database"]
   - If workflow needs output channel: Ask "Where should responses be delivered?" with options: ["Slack", "Discord", "Email", "Webhook Response", "Database"]
   - If workflow needs trigger: Ask "How should the workflow be triggered?" with options: ["Webhook", "Slack Bot", "Discord Bot", "Scheduled", "Manual"]
   - Use category: "node_selection" for these questions

2. THEN: Ask for credentials ONLY for selected services:
   - After user selects a service, ask for credentials for THAT service only
   - Example: User selects "OpenAI GPT" → Ask "Please provide your OpenAI API key"
   - Use category: "credentials" for these questions
   - NEVER ask for credentials for services the user hasn't selected

3. Identify missing business requirements:
   - What data/content needs to be processed?
   - What are the scheduling preferences?
   - Where should results be sent/stored?

4. Identify uncertainties:
   - Ambiguous time references (convert to specific times)
   - Unclear data sources or destinations
   - Missing configuration details
   - Edge cases or error handling preferences

5. Extract implicit requirements:
   - Error handling needs (if user mentions "reliable", "important")
   - Logging needs (if user mentions "audit", "track")
   - Notification needs (if user mentions "alert", "notify")

6. Question Format:
   - Each question should be specific and actionable
   - Provide 3-4 multiple choice options
   - Options should represent actual service choices (OpenAI, Anthropic, etc.) or scenarios
   - Question text should ONLY contain the question (no option letters)

Example of CORRECT format (for chatbot workflow):
{
  "summary": "Automated customer support chatbot workflow with AI-powered responses and multi-channel delivery",
  "questions": [
    {
      "id": "q1",
      "text": "Which AI provider would you like to use for generating responses?",
      "options": ["OpenAI GPT", "Anthropic Claude", "Google Gemini", "Local/Ollama"],
      "category": "node_selection"
    },
    {
      "id": "q2",
      "text": "Where should the chatbot retrieve knowledge from?",
      "options": ["Vector Database", "FAQ Files", "Product Documentation", "Previous Conversations"],
      "category": "node_selection"
    },
    {
      "id": "q3",
      "text": "Where should responses be delivered?",
      "options": ["Slack Channel", "Discord Channel", "Webhook Response", "Email"],
      "category": "node_selection"
    },
    {
      "id": "q4",
      "text": "What data should the chatbot use?",
      "options": ["Customer FAQs", "Product Documentation", "User Feedback", "All of the above"],
      "category": "content"
    }
  ]
}

Note: After user answers q1 with "OpenAI GPT", you would ask: "Please provide your OpenAI API key" (category: "credentials")

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
      "text": "Question about service selection or business requirement?",
      "options": ["Option 1", "Option 2", "Option 3"],
      "category": "node_selection|content|schedule|credentials|destination|error_handling|data_source|preferences|other"
    }
  ],
  "intent": "dataSync|notification|transformation|apiIntegration|scheduledTask|chatbot",
  "entities": ["entity1", "entity2"],
  "implicitRequirements": ["requirement1", "requirement2"]
}

IMPORTANT: Prioritize "node_selection" questions first. Only ask "credentials" questions AFTER the user has selected specific services.`;

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
      'node_selection',
      'content',
      'schedule',
      'authentication',
      'credentials',
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
