// Enhanced Workflow Analyzer
// Integrates multi-node detection with standard workflow analysis

import { WorkflowAnalyzer, AnalysisResult, Question, QuestionCategory } from './workflow-analyzer';
import { nodeEquivalenceMapper, MultiNodeDetectionResult, NodeOption } from './node-equivalence-mapper';
import { questionFormatter } from './question-formatter';

export interface EnhancedAnalysisResult extends AnalysisResult {
  nodeOptionsDetected: MultiNodeDetectionResult[];
  hasNodeChoices: boolean;
}

export interface NodePreferenceQuestion extends Question {
  type: 'node_preference';
  category: QuestionCategory;
  nodeOptions: NodeOption[];
  helpText?: string;
  followUpQuestions?: Question[];
}

/**
 * EnhancedWorkflowAnalyzer - Extends WorkflowAnalyzer with multi-node detection
 * 
 * Detects when multiple nodes can accomplish the same task and generates
 * preference questions in user-friendly language
 */
export class EnhancedWorkflowAnalyzer {
  private baseAnalyzer: WorkflowAnalyzer;
  
  constructor() {
    this.baseAnalyzer = new WorkflowAnalyzer();
  }

  /**
   * Analyze prompt with node option detection
   */
  async analyzePromptWithNodeOptions(
    userPrompt: string,
    context?: {
      existingWorkflow?: any;
      userHistory?: any[];
    }
  ): Promise<EnhancedAnalysisResult> {
    // Step 1: Standard analysis (existing functionality)
    const baseAnalysis = await this.baseAnalyzer.analyzePrompt(userPrompt, context);
    
    // Step 2: Detect multi-node options
    const nodeOptions = nodeEquivalenceMapper.detectMultiNodeOptions(userPrompt);
    
    // Step 3: Generate preference questions
    const preferenceQuestions = this.generatePreferenceQuestions(nodeOptions, userPrompt);
    
    // Step 4: Combine with standard questions
    // Convert NodePreferenceQuestion to Question for compatibility
    const allQuestions: Question[] = [
      ...baseAnalysis.questions,
      ...preferenceQuestions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        category: q.category
      }))
    ];
    
    return {
      ...baseAnalysis,
      nodeOptionsDetected: nodeOptions,
      questions: allQuestions,
      hasNodeChoices: nodeOptions.length > 0
    };
  }
  
  /**
   * Generate preference questions from detected node options
   */
  private generatePreferenceQuestions(
    nodeOptions: MultiNodeDetectionResult[],
    userPrompt: string
  ): NodePreferenceQuestion[] {
    return nodeOptions.map(option => {
      const formatted = questionFormatter.formatNodeChoiceQuestion(
        option.category,
        option.options,
        userPrompt
      );
      
      // Map category to QuestionCategory
      const questionCategory: QuestionCategory = 
        option.category === 'notification' ? 'destination' :
        option.category === 'database' ? 'data_source' :
        option.category === 'file_storage' ? 'data_source' :
        option.category === 'scheduling' ? 'schedule' :
        option.category === 'authentication' ? 'authentication' :
        'preferences';
      
      return {
        id: `node_pref_${option.category}`,
        type: 'node_preference',
        category: questionCategory,
        text: this.formatNodePreferenceQuestion(option, formatted),
        options: formatted.options.map(opt => `${opt.icon} ${opt.label}`),
        nodeOptions: option.options,
        helpText: formatted.recommendation || this.getNodeChoiceHelpText(option.category),
        followUpQuestions: this.getFollowUpQuestionsForNode(option.category)
      };
    });
  }
  
  /**
   * Format node preference question text
   */
  private formatNodePreferenceQuestion(
    option: MultiNodeDetectionResult,
    formatted: any
  ): string {
    const commonScenarios = this.getCommonScenariosForCategory(option.category);
    
    let questionText = formatted.question + '\n\n';
    
    // Add options with descriptions
    formatted.options.forEach((opt: any) => {
      questionText += `${opt.icon} **${opt.label}** - ${opt.description}\n`;
      if (opt.bestFor && opt.bestFor.length > 0) {
        questionText += `   Best for: ${opt.bestFor.join(', ')}\n`;
      }
    });
    
    if (commonScenarios) {
      questionText += `\n${commonScenarios}\n`;
    }
    
    if (formatted.recommendation) {
      questionText += `\n${formatted.recommendation}\n`;
    }
    
    return questionText.trim();
  }
  
  /**
   * Get common scenarios for category
   */
  private getCommonScenariosForCategory(category: string): string {
    const scenarios: Record<string, string> = {
      notification: "💡 Common use cases:\n- Slack: Team alerts, daily standups\n- Email: Customer notifications, reports\n- SMS: Urgent alerts, 2FA codes\n- Gmail: Business emails, Google Workspace integration",
      database: "💡 Common use cases:\n- PostgreSQL: Complex queries, relational data\n- Supabase: Real-time apps, user management\n- MySQL: Web applications, content management",
      file_storage: "💡 Common use cases:\n- S3: Large files, backups\n- Google Drive: Team collaboration\n- FTP: Legacy systems, file transfers",
      authentication: "💡 Common use cases:\n- OAuth: Social login, third-party integration\n- API Key: Service-to-service\n- Basic Auth: Simple internal tools",
      scheduling: "💡 Common use cases:\n- Schedule: Daily reports, regular syncs\n- Webhook: Real-time events, API callbacks\n- Manual: Testing, ad-hoc tasks"
    };
    
    return scenarios[category] || "";
  }
  
  /**
   * Get help text for node choice
   */
  private getNodeChoiceHelpText(category: string): string {
    const helpTexts: Record<string, string> = {
      notification: "Consider who needs the notification, urgency, and existing tools your team uses.",
      database: "Think about your data structure, team skills, and scalability needs.",
      file_storage: "Consider file sizes, access patterns, and integration with other services.",
      authentication: "Balance security needs with user experience and implementation complexity.",
      scheduling: "Consider whether you need fixed times, event triggers, or manual control."
    };
    
    return helpTexts[category] || "Choose the option that best fits your needs and existing infrastructure.";
  }
  
  /**
   * Get follow-up questions based on selected node
   */
  private getFollowUpQuestionsForNode(nodeType: string): Question[] {
    const followUpMap: Record<string, Question[]> = {
      slack: [
        {
          id: 'slack_channel',
          text: 'Which Slack channel should receive the message?',
          options: ['#general', '#notifications', '@username', 'I\'ll provide it later'],
          category: 'destination' as QuestionCategory
        },
        {
          id: 'slack_format',
          text: 'How should the message be formatted?',
          options: ['Plain text', 'Rich format with attachments', 'Interactive buttons'],
          category: 'preferences' as QuestionCategory
        }
      ],
      email: [
        {
          id: 'email_recipients',
          text: 'Who should receive the email?',
          options: ['Single recipient', 'Multiple recipients', 'Dynamic from data', 'I\'ll configure later'],
          category: 'destination' as QuestionCategory
        },
        {
          id: 'email_subject',
          text: 'What should the subject line be?',
          options: ['Static text', 'Dynamic from data', 'Template with variables', 'I\'ll configure later'],
          category: 'content' as QuestionCategory
        }
      ],
      discord: [
        {
          id: 'discord_webhook',
          text: 'Do you have a Discord webhook URL?',
          options: ['Yes, I have it', 'No, I need help setting up', 'I\'ll provide it later'],
          category: 'authentication' as QuestionCategory
        }
      ],
      twilio: [
        {
          id: 'twilio_credentials',
          text: 'Do you have Twilio credentials configured?',
          options: ['Yes, all set up', 'No, I need help', 'I\'ll provide them later'],
          category: 'authentication' as QuestionCategory
        },
        {
          id: 'twilio_recipients',
          text: 'Who should receive the SMS?',
          options: ['Single phone number', 'Multiple numbers', 'Dynamic from data'],
          category: 'destination' as QuestionCategory
        }
      ],
      schedule: [
        {
          id: 'schedule_time',
          text: 'What time should this run?',
          options: ['9 AM', '12 PM', '6 PM', 'Custom time'],
          category: 'schedule' as QuestionCategory
        },
        {
          id: 'schedule_frequency',
          text: 'How often should this run?',
          options: ['Daily', 'Weekly', 'Monthly', 'Custom schedule'],
          category: 'schedule' as QuestionCategory
        }
      ],
      interval: [
        {
          id: 'interval_duration',
          text: 'How often should this run?',
          options: ['Every 5 minutes', 'Every hour', 'Every 6 hours', 'Custom interval'],
          category: 'schedule' as QuestionCategory
        }
      ],
      webhook: [
        {
          id: 'webhook_method',
          text: 'What HTTP method should the webhook accept?',
          options: ['GET', 'POST', 'PUT', 'Any'],
          category: 'preferences' as QuestionCategory
        }
      ],
      supabase: [
        {
          id: 'supabase_setup',
          text: 'Do you have a Supabase project set up?',
          options: ['Yes, I have credentials', 'No, I need help', 'I\'ll provide them later'],
          category: 'authentication' as QuestionCategory
        }
      ],
      postgresql: [
        {
          id: 'postgresql_connection',
          text: 'Do you have PostgreSQL connection details?',
          options: ['Yes, I have them', 'No, I need help', 'I\'ll provide them later'],
          category: 'authentication' as QuestionCategory
        }
      ]
    };
    
    return followUpMap[nodeType] || [];
  }
  
  /**
   * Extract node preferences from user answers
   */
  extractNodePreferences(answers: Record<string, string>): Record<string, string> {
    const preferences: Record<string, string> = {};
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (questionId.startsWith('node_pref_')) {
        const category = questionId.replace('node_pref_', '');
        // Extract node ID from answer (e.g., "💬 Slack Message" -> "slack")
        const nodeId = this.extractNodeIdFromAnswer(answer);
        if (nodeId) {
          preferences[category] = nodeId;
        }
      }
    }
    
    return preferences;
  }
  
  /**
   * Extract node ID from user's answer
   */
  private extractNodeIdFromAnswer(answer: string): string | null {
    // Answer format: "💬 Slack Message" or just "Slack Message"
    const lowerAnswer = answer.toLowerCase();
    
    // Map common answer patterns to node IDs
    const nodeIdMap: Record<string, string> = {
      'slack': 'slack',
      'email': 'email',
      'discord': 'discord',
      'sms': 'twilio',
      'twilio': 'twilio',
      'gmail': 'gmail',
      'postgresql': 'postgresql',
      'postgres': 'postgresql',
      'supabase': 'supabase',
      'mysql': 'mysql',
      's3': 's3',
      'aws s3': 's3',
      'google drive': 'google_drive',
      'drive': 'google_drive',
      'schedule': 'schedule',
      'interval': 'interval',
      'webhook': 'webhook',
      'manual': 'manual'
    };
    
    for (const [key, nodeId] of Object.entries(nodeIdMap)) {
      if (lowerAnswer.includes(key)) {
        return nodeId;
      }
    }
    
    return null;
  }
}

// Export singleton instance
export const enhancedWorkflowAnalyzer = new EnhancedWorkflowAnalyzer();
