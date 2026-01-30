// Requirements Extractor Service
// Step 4: Extract technical requirements from refined prompt
// Uses Llama 3.1:8B to extract URLs, APIs, credentials, schedules, etc.

import { ollamaOrchestrator } from './ollama-orchestrator';
import { Requirements } from '../../core/types/ai-types';

export interface ExtractedRequirements extends Requirements {
  // Extended requirements
  urls: string[];
  apis: string[];
  credentials: string[];
  schedules: string[];
  platforms: string[];
  dataFormats: string[];
  errorHandling: string[];
  notifications: string[];
}

/**
 * RequirementsExtractor - Step 4: Extract Technical Requirements
 * 
 * Extracts technical requirements from user prompt and answers:
 * - URLs and API endpoints
 * - Required credentials
 * - Schedule information
 * - Data formats
 * - Error handling preferences
 * - Notification requirements
 */
export class RequirementsExtractor {
  private readonly model = 'llama3.1:8b';

  /**
   * Extract workflow requirements from refined prompt
   */
  async extractRequirements(
    userPrompt: string,
    systemPrompt: string,
    answers?: Record<string, string>,
    constraints?: any
  ): Promise<ExtractedRequirements> {
    console.log(`📋 Extracting requirements from: "${systemPrompt}"`);

    const extractionPrompt = this.buildExtractionPrompt(
      userPrompt,
      systemPrompt,
      answers,
      constraints
    );

    try {
      const response = await ollamaOrchestrator.processRequest(
        'workflow-analysis',
        {
          system: this.buildSystemPrompt(),
          message: extractionPrompt,
        },
        {
          temperature: 0.3, // Lower temperature for more accurate extraction
          max_tokens: 2000,
          cache: false,
        }
      );

      return this.parseRequirementsResponse(response, systemPrompt);
    } catch (error) {
      console.error('❌ Error extracting requirements:', error);
      return this.generateFallbackRequirements(systemPrompt);
    }
  }

  /**
   * Build system prompt for requirements extraction
   */
  private buildSystemPrompt(): string {
    return `You are an expert Requirements Extraction Agent. Your role is to extract technical requirements from workflow descriptions.

Your task:
1. Identify all URLs, API endpoints, and service URLs
2. Identify required credentials and authentication methods
3. Extract schedule information (cron expressions, frequencies)
4. Identify data formats and structures
5. Extract error handling requirements
6. Identify notification needs
7. Determine platform/service integrations

Return structured JSON with all extracted requirements.`;
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(
    userPrompt: string,
    systemPrompt: string,
    answers?: Record<string, string>,
    constraints?: any
  ): string {
    let prompt = `Extract technical requirements from this workflow description:

System Prompt (Understanding): "${systemPrompt}"
Original User Prompt: "${userPrompt}"

`;

    // Add answers if available
    if (answers && Object.keys(answers).length > 0) {
      prompt += `User Answers to Questions:\n`;
      Object.entries(answers).forEach(([questionId, answer]) => {
        prompt += `  ${questionId}: ${answer}\n`;
      });
      prompt += '\n';
    }

    // Add constraints if available
    if (constraints) {
      prompt += `Constraints: ${JSON.stringify(constraints, null, 2)}\n\n`;
    }

    prompt += `Extract the following requirements:

1. URLs & API Endpoints:
   - Any URLs mentioned (API endpoints, webhooks, services)
   - Extract from text or infer from service names
   - Format: ["https://api.example.com", "https://webhook.example.com"]

2. APIs & Services:
   - Service names (Twitter, Slack, Google Sheets, etc.)
   - API types (REST, GraphQL, Webhook)
   - Format: ["Twitter API", "Slack API", "Google Sheets API"]

3. Credentials Required:
   - Authentication methods needed
   - Service credentials (API keys, OAuth, etc.)
   - Format: ["Twitter API Key", "Slack Bot Token", "Database Credentials"]

4. Schedules:
   - Time-based triggers (daily, hourly, cron expressions)
   - Extract or infer cron expressions
   - Format: ["0 9 * * *", "*/30 * * * *"]

5. Data Formats:
   - Input/output data formats
   - File types, data structures
   - Format: ["JSON", "CSV", "XML"]

6. Error Handling:
   - Retry logic mentioned
   - Error notification preferences
   - Format: ["retry on failure", "send alert on error"]

7. Notifications:
   - Notification channels mentioned
   - Alert preferences
   - Format: ["email", "slack", "sms"]

8. Platforms:
   - Platforms/services to integrate with
   - Format: ["Twitter", "Slack", "PostgreSQL", "Supabase"]

Return JSON in this exact format:
{
  "primaryGoal": "Brief description of primary goal",
  "keySteps": ["step1", "step2", "step3"],
  "inputs": ["input1", "input2"],
  "outputs": ["output1", "output2"],
  "constraints": ["constraint1", "constraint2"],
  "complexity": "simple|medium|complex",
  "urls": ["url1", "url2"],
  "apis": ["api1", "api2"],
  "credentials": ["credential1", "credential2"],
  "schedules": ["cron1", "cron2"],
  "dataFormats": ["format1", "format2"],
  "errorHandling": ["handling1", "handling2"],
  "notifications": ["notification1", "notification2"],
  "platforms": ["platform1", "platform2"]
}`;

    return prompt;
  }

  /**
   * Parse AI response into ExtractedRequirements
   */
  private parseRequirementsResponse(
    response: any,
    systemPrompt: string
  ): ExtractedRequirements {
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

      // Normalize and validate
      return {
        primaryGoal: parsed.primaryGoal || this.extractPrimaryGoal(systemPrompt),
        keySteps: Array.isArray(parsed.keySteps) ? parsed.keySteps : this.extractKeySteps(systemPrompt),
        inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
        outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        complexity: this.normalizeComplexity(parsed.complexity),
        urls: this.normalizeArray(parsed.urls),
        apis: this.normalizeArray(parsed.apis),
        credentials: this.normalizeArray(parsed.credentials),
        schedules: this.normalizeArray(parsed.schedules),
        dataFormats: this.normalizeArray(parsed.dataFormats),
        errorHandling: this.normalizeArray(parsed.errorHandling),
        notifications: this.normalizeArray(parsed.notifications),
        platforms: this.normalizeArray(parsed.platforms),
      };
    } catch (error) {
      console.error('❌ Error parsing requirements response:', error);
      return this.generateFallbackRequirements(systemPrompt);
    }
  }

  /**
   * Normalize array fields
   */
  private normalizeArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v)).filter(v => v.length > 0);
    }
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    return [];
  }

  /**
   * Normalize complexity
   */
  private normalizeComplexity(value: any): 'simple' | 'medium' | 'complex' {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'simple' || lower === 'easy' || lower === 'basic') return 'simple';
      if (lower === 'complex' || lower === 'advanced' || lower === 'hard') return 'complex';
    }
    return 'medium';
  }

  /**
   * Extract primary goal from system prompt
   */
  private extractPrimaryGoal(systemPrompt: string): string {
    // Simple extraction - take first sentence
    const sentences = systemPrompt.split(/[.!?]/);
    return sentences[0]?.trim() || systemPrompt.slice(0, 100);
  }

  /**
   * Extract key steps from system prompt
   */
  private extractKeySteps(systemPrompt: string): string[] {
    // Simple extraction - look for action verbs
    const actions = [
      'fetch', 'get', 'retrieve', 'send', 'post', 'update', 'create',
      'sync', 'process', 'transform', 'validate', 'notify', 'schedule'
    ];
    
    const steps: string[] = [];
    const lowerPrompt = systemPrompt.toLowerCase();
    
    actions.forEach(action => {
      if (lowerPrompt.includes(action)) {
        steps.push(action);
      }
    });

    return steps.length > 0 ? steps : ['process', 'execute'];
  }

  /**
   * Generate fallback requirements if extraction fails
   */
  private generateFallbackRequirements(systemPrompt: string): ExtractedRequirements {
    const lowerPrompt = systemPrompt.toLowerCase();
    
    // Detect common patterns
    const urls: string[] = [];
    const apis: string[] = [];
    const credentials: string[] = [];
    const schedules: string[] = [];
    const platforms: string[] = [];

    // Detect services
    if (lowerPrompt.includes('twitter')) {
      apis.push('Twitter API');
      credentials.push('Twitter API Credentials');
      platforms.push('Twitter');
    }
    if (lowerPrompt.includes('slack')) {
      apis.push('Slack API');
      credentials.push('Slack Bot Token');
      platforms.push('Slack');
    }
    if (lowerPrompt.includes('google') || lowerPrompt.includes('gmail') || lowerPrompt.includes('sheets')) {
      apis.push('Google API');
      credentials.push('Google OAuth');
      platforms.push('Google');
    }
    if (lowerPrompt.includes('database') || lowerPrompt.includes('postgres') || lowerPrompt.includes('supabase')) {
      credentials.push('Database Credentials');
      platforms.push('Database');
    }

    // Detect schedules
    if (lowerPrompt.includes('daily') || lowerPrompt.includes('every day')) {
      schedules.push('0 9 * * *'); // Default: 9 AM daily
    } else if (lowerPrompt.includes('hourly') || lowerPrompt.includes('every hour')) {
      schedules.push('0 * * * *');
    } else if (lowerPrompt.includes('weekly') || lowerPrompt.includes('every week')) {
      schedules.push('0 9 * * 1'); // Monday 9 AM
    }

    return {
      primaryGoal: this.extractPrimaryGoal(systemPrompt),
      keySteps: this.extractKeySteps(systemPrompt),
      inputs: [],
      outputs: [],
      constraints: [],
      complexity: 'medium',
      urls,
      apis,
      credentials,
      schedules,
      dataFormats: ['JSON'],
      errorHandling: ['retry on failure'],
      notifications: [],
      platforms,
    };
  }
}

// Export singleton instance
export const requirementsExtractor = new RequirementsExtractor();
