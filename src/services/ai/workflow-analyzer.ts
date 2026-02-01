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
          temperature: 0.3, // Lower temperature for more consistent, rule-following behavior
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
   * STEP 2: CLARIFICATION QUESTIONING ENGINE
   */
  private buildSystemPrompt(): string {
    return `SYSTEM PROMPT — STEP 2: CLARIFICATION QUESTIONING ENGINE

ROLE
You are an intelligent clarification agent inside an Autonomous Workflow Agent system.

Your responsibility is to ask ONLY the most critical, relevant, and minimal set of clarification questions required to correctly design an executable automation workflow.

You DO NOT generate workflows.
You ONLY ask questions.

Your questions directly affect workflow correctness.

---

PRIMARY OBJECTIVE

From the user's natural language prompt, identify:
- Missing information
- Ambiguous intent
- Configuration choices
- Execution constraints

Then ask short, clear, user-friendly questions to resolve them.

Your goal is to collect exactly the information required to build a 100% correct workflow — nothing more, nothing less.

---

STRICT RULES (MANDATORY)

1. ❌ NEVER ask duplicate questions
2. ❌ NEVER repeat the same question in different wording
3. ❌ NEVER ask generic questions like:
   - "When should this run?" (too generic - be specific: "What time should the post be published?")
   - "When should this workflow run?" (if prompt already mentions timing like "daily morning")
   - "Select one option" (without explanation)
4. ❌ NEVER ask questions that do NOT affect workflow structure
5. ❌ NEVER ask implementation-level or technical questions
6. ❌ NEVER assume missing information
7. ❌ NEVER ask more than necessary
8. ❌ NEVER ask the same question twice (check your question list before adding new ones)

---

QUESTION QUALITY RULES

Each question MUST:
- Be directly related to the user's prompt
- Affect workflow logic, nodes, or execution
- Be understandable by a non-technical user
- Be short (one clear sentence)
- Have clear selectable options (when applicable)

---

QUESTION CATEGORIES (ASK ONLY IF NEEDED)

You may ask questions ONLY from these categories:

1. Trigger & Scheduling
2. Platform / Service Selection
3. Content / Data Source
4. Execution Rules
5. Error Handling Preferences
6. Approval / Review Flow
7. Output / Destination
8. Frequency & Limits

---

QUESTION PRIORITY ORDER

Always ask questions in this order:
1. Trigger / Schedule
2. Platform selection
3. Required inputs
4. Automation rules
5. Error handling
6. Optional enhancements

Stop asking once enough information is collected.

---

QUESTION FORMAT (MANDATORY)

Each question must follow this structure:

- Question title (short and clear)
- One-line explanation (optional, very short)
- Options (if applicable)

Example format:

Q1. When should this automation run?
• Every day at a fixed time  
• Multiple times per day  
• Only when triggered manually  

---

EXAMPLE — FOR USER PROMPT:
"Post a post to my social media account daily morning"

CORRECT QUESTIONS SHOULD BE:

Q1. Which social media platform do you want to post on?
• Instagram
• LinkedIn
• Twitter / X
• Facebook
• Multiple platforms

Q2. What time should the post be published?
• Select a specific time (e.g., 9:00 AM)
• Use platform's best-time suggestion

Q3. Where should the post content come from?
• Manually written text
• AI-generated content
• From a document or spreadsheet

Q4. Do you want the same post on all platforms or platform-specific content?
• Same content everywhere
• Customize per platform

Q5. What should happen if posting fails?
• Retry automatically
• Notify me
• Skip and continue next day

---

INVALID QUESTIONS (DO NOT ASK)

❌ "When should this workflow run?" (too generic - if prompt says "daily morning", ask "What time?" instead)
❌ "When should this run?" (too generic - be specific about what aspect of timing)
❌ Repeating the same question twice (ALWAYS check for duplicates)
❌ Asking scheduling twice (if you already asked about schedule, don't ask again)
❌ Asking technical API or token questions (ask for platform selection first, then credentials)
❌ Asking questions unrelated to the prompt
❌ Generic questions that don't add value (e.g., "How should this be configured?" - too vague)

VALID QUESTIONS FOR "Post to social media daily morning":
✅ "Which social media platform do you want to post on?" (platform selection - CRITICAL)
✅ "What time should the post be published?" (specific timing - CRITICAL)
✅ "Where should the post content come from?" (content source - IMPORTANT)
✅ "Do you want the same post on all platforms?" (platform behavior - OPTIONAL)

---

STOP CONDITION

Once all required decisions are clarified:
- STOP asking questions
- Return structured answers to the Workflow Builder

DO NOT generate workflows.
DO NOT explain reasoning.
ONLY ask clarification questions.`;
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
    let prompt = `User Request: "${userPrompt}"`;

    // Add context if available
    if (context?.existingWorkflow) {
      prompt += `\n\nContext: User is modifying an existing workflow.`;
    }

    if (context?.userHistory && context.userHistory.length > 0) {
      prompt += `\n\nUser History: User has created ${context.userHistory.length} workflow(s) before.`;
    }

    prompt += `\n\nAnalyze this request and ask ONLY the most critical clarification questions needed to build a correct workflow.

CRITICAL: Follow the system prompt rules EXACTLY:
1. Ask questions in priority order: Trigger/Schedule → Platform selection → Required inputs → Automation rules → Error handling → Credentials (if AI/LLM is needed)
2. Each question must affect workflow structure or execution
3. NEVER ask duplicate questions - check if you already asked something similar
4. NEVER ask generic questions like "When should this run?" - be specific (e.g., "What time should the post be published?")
5. For social media posts: Ask "Which platform?" FIRST, then "What time?", then "Where should content come from?"
6. If the workflow requires AI Agent or LLM functionality (chatbot, text generation, analysis, etc.), the system will automatically ask for Google Gemini API key - you don't need to ask about credentials
7. Stop once enough information is collected (3-5 questions max)

IMPORTANT EXAMPLES:
- For "post to social media daily morning" → Ask: "Which platform?" → "What time?" → "Where should content come from?"
- For "create a chatbot" → Ask: "Where should responses be delivered?" → "What data should the chatbot use?" (API key will be asked automatically)
- NEVER ask "When should this workflow run?" if the prompt already mentions "daily morning"
- NEVER repeat the same question twice
- NEVER ask about API keys or credentials directly - the system handles this automatically for AI workflows

Return ONLY valid JSON in this format:
{
  "summary": "20-30 word summary of what you understood",
  "questions": [
    {
      "id": "q1",
      "text": "Clear, specific question (one sentence, NOT generic)",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "category": "node_selection|content|schedule|credentials|destination|error_handling|data_source|preferences|other"
    }
  ],
  "intent": "dataSync|notification|transformation|apiIntegration|scheduledTask|chatbot|other",
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

      // Remove duplicates before checking count
      result.questions = this.normalizeQuestions(result.questions);

      // Check if AI Agent/LLM functionality is needed and add Google Gemini API key question
      if (this.detectAIFunctionalityNeeded(userPrompt, result)) {
        // Check if we already asked about API keys or credentials
        const hasCredentialQuestion = result.questions.some(q => 
          q.category === 'credentials' || 
          q.text.toLowerCase().includes('api key') ||
          q.text.toLowerCase().includes('credential') ||
          q.text.toLowerCase().includes('gemini')
        );
        
        if (!hasCredentialQuestion) {
          const geminiApiKeyQuestion: Question = {
            id: `q${result.questions.length + 1}`,
            text: 'Please provide your Google Gemini API key (required for AI Agent functionality)',
            options: ['I have an API key - will provide it', 'I need to create one', 'Use environment variable (GOOGLE_GEMINI_API_KEY)'],
            category: 'credentials',
          };
          result.questions.push(geminiApiKeyQuestion);
        }
      }

      // Ensure we have at least 3 questions (but don't add duplicates)
      if (result.questions.length < 3) {
        const fallback = this.generateFallbackQuestions(userPrompt);
        const existingTexts = new Set(result.questions.map(q => q.text.toLowerCase().trim()));
        
        for (const fallbackQ of fallback.questions) {
          if (result.questions.length >= 5) break;
          const fallbackText = fallbackQ.text.toLowerCase().trim();
          const isDuplicate = Array.from(existingTexts).some(existing => 
            this.calculateTextSimilarity(fallbackText, existing) > 0.85
          );
          if (!isDuplicate) {
            result.questions.push(fallbackQ);
            existingTexts.add(fallbackText);
          }
        }
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
   * Normalize questions array with deduplication
   */
  private normalizeQuestions(questions: any[]): Question[] {
    const normalized = questions
      .slice(0, 5) // Max 5 questions
      .map((q, index) => ({
        id: q.id || `q${index + 1}`,
        text: this.cleanQuestionText(q.text || q.question || ''),
        options: this.normalizeOptions(q.options || []),
        category: this.normalizeCategory(q.category),
      }))
      .filter(q => q.text.length > 0 && q.options.length >= 2);

    // Remove duplicates based on text similarity
    const uniqueQuestions: Question[] = [];
    const seenTexts = new Set<string>();

    for (const question of normalized) {
      const normalizedText = question.text.toLowerCase().trim();
      const isDuplicate = Array.from(seenTexts).some(seen => {
        // Check if questions are too similar (same meaning)
        const similarity = this.calculateTextSimilarity(normalizedText, seen);
        return similarity > 0.85; // 85% similarity threshold
      });

      if (!isDuplicate) {
        seenTexts.add(normalizedText);
        uniqueQuestions.push(question);
      }
    }

    return uniqueQuestions;
  }

  /**
   * Calculate text similarity between two strings (simple word overlap)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Detect if AI Agent or LLM functionality is needed based on user prompt
   */
  private detectAIFunctionalityNeeded(userPrompt: string, analysis: AnalysisResult): boolean {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Direct AI-related keywords
    const aiKeywords = [
      'ai agent', 'ai assistant', 'chatbot', 'chat bot', 'llm', 'language model',
      'generate', 'analyze', 'summarize', 'classify', 'sentiment', 'intent',
      'natural language', 'nlp', 'text analysis', 'content generation',
      'ai-powered', 'ai powered', 'using ai', 'with ai', 'ai model',
      'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'ollama'
    ];
    
    // Check if prompt contains AI-related keywords
    const hasAIKeywords = aiKeywords.some(keyword => lowerPrompt.includes(keyword));
    
    // Check if intent suggests AI usage
    const aiIntents = ['chatbot', 'transformation', 'notification'];
    const hasAIIntent = analysis.intent && aiIntents.includes(analysis.intent);
    
    // Check if questions suggest AI usage (e.g., asking about AI providers)
    const hasAIQuestion = analysis.questions.some(q => 
      q.text.toLowerCase().includes('ai') ||
      q.text.toLowerCase().includes('model') ||
      q.text.toLowerCase().includes('provider') ||
      q.category === 'node_selection' && (
        q.options.some(opt => opt.toLowerCase().includes('ai') || 
                            opt.toLowerCase().includes('gpt') ||
                            opt.toLowerCase().includes('claude') ||
                            opt.toLowerCase().includes('gemini'))
      )
    );
    
    // Check implicit requirements
    const hasAIRequirement = analysis.implicitRequirements?.some(req => 
      req.toLowerCase().includes('ai') ||
      req.toLowerCase().includes('llm') ||
      req.toLowerCase().includes('model')
    );
    
    return hasAIKeywords || hasAIIntent || hasAIQuestion || hasAIRequirement || false;
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
    
    // Social media posting
    if (lowerPrompt.includes('social media') || lowerPrompt.includes('post') || lowerPrompt.includes('instagram') || lowerPrompt.includes('twitter') || lowerPrompt.includes('linkedin') || lowerPrompt.includes('facebook')) {
      questions = [
        {
          id: 'q1',
          text: 'Which social media platform do you want to post on?',
          options: ['Instagram', 'LinkedIn', 'Twitter / X', 'Facebook', 'Multiple platforms'],
          category: 'node_selection' as QuestionCategory,
        },
        {
          id: 'q2',
          text: 'What time should the post be published?',
          options: ['Select a specific time (e.g., 9:00 AM)', 'Use platform\'s best-time suggestion', 'Morning (6-9 AM)', 'Afternoon (12-3 PM)'],
          category: 'schedule' as QuestionCategory,
        },
        {
          id: 'q3',
          text: 'Where should the post content come from?',
          options: ['Manually written text', 'AI-generated content', 'From a document or spreadsheet', 'Template with variables'],
          category: 'content' as QuestionCategory,
        },
      ];
    } else if (lowerPrompt.includes('sync') || lowerPrompt.includes('copy') || lowerPrompt.includes('import')) {
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
      // Generic questions - More specific than before
      questions = [
        {
          id: 'q1',
          text: 'How should this workflow be triggered?',
          options: ['Fixed Schedule', 'Regular Intervals', 'Event Trigger', 'Manual Run'],
          category: 'schedule' as QuestionCategory,
        },
        {
          id: 'q2',
          text: 'What platform or service should be used?',
          options: ['Specify platform', 'Multiple platforms', 'No specific platform', 'Let system choose'],
          category: 'node_selection' as QuestionCategory,
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
