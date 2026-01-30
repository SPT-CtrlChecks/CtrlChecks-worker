// Question Formatter
// Converts technical node choices to user-friendly questions

import { NodeOption, MultiNodeDetectionResult } from './node-equivalence-mapper';

export interface DisplayOption {
  value: string;
  label: string;
  icon: string;
  description: string;
  pros: string[];
  cons: string[];
  bestFor: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface FormattedQuestion {
  question: string;
  explanation: string;
  options: DisplayOption[];
  recommendation?: string;
  considerations: string[];
}

/**
 * QuestionFormatter - Converts technical node choices to user-friendly questions
 */
export class QuestionFormatter {
  /**
   * Format node choice question for user display
   */
  formatNodeChoiceQuestion(
    category: string,
    options: NodeOption[],
    userPrompt?: string
  ): FormattedQuestion {
    const baseQuestion = this.getBaseQuestion(category, userPrompt);
    
    return {
      question: baseQuestion,
      explanation: this.getCategoryExplanation(category),
      options: this.formatOptionsForDisplay(options),
      recommendation: this.getRecommendation(category, options),
      considerations: this.getConsiderations(category)
    };
  }
  
  /**
   * Format options for display with pros/cons
   */
  private formatOptionsForDisplay(options: NodeOption[]): DisplayOption[] {
    return options.map(option => ({
      value: option.id,
      label: this.getUserFriendlyLabel(option.name),
      icon: option.icon,
      description: option.description,
      pros: this.getProsForNode(option.id),
      cons: this.getConsForNode(option.id),
      bestFor: this.getBestUseCases(option.id),
      complexity: this.getComplexityRating(option.id)
    }));
  }
  
  /**
   * Get base question text for category
   */
  private getBaseQuestion(category: string, userPrompt?: string): string {
    const templates: Record<string, string> = {
      notification: userPrompt?.toLowerCase().includes('notify') || userPrompt?.toLowerCase().includes('alert')
        ? "How would you like to receive notifications?"
        : "How should I send the notification?",
      database: "Where should I store the data?",
      file_storage: "Where should I store the files?",
      authentication: "How should users authenticate?",
      scheduling: "When should this workflow run?"
    };
    
    return templates[category] || `How would you like to handle ${category}?`;
  }
  
  /**
   * Get category explanation
   */
  private getCategoryExplanation(category: string): string {
    const explanations: Record<string, string> = {
      notification: "Different notification methods have different strengths. Some are better for urgent alerts, others for detailed reports.",
      database: "The choice of database affects performance, scalability, and ease of use for different types of data.",
      file_storage: "File storage options vary in cost, accessibility, and integration capabilities.",
      authentication: "Authentication methods balance security, user experience, and implementation complexity.",
      scheduling: "Trigger methods determine when and how your workflow runs."
    };
    
    return explanations[category] || "";
  }
  
  /**
   * Get recommendation based on category and options
   */
  private getRecommendation(category: string, options: NodeOption[]): string {
    if (category === 'notification') {
      const hasSlack = options.some(o => o.id === 'slack');
      const hasEmail = options.some(o => o.id === 'email');
      const hasSMS = options.some(o => o.id === 'twilio');
      
      if (hasSlack && hasEmail && hasSMS) {
        return "💡 Recommendation: Use Slack for team alerts, Email for customer notifications or detailed reports, and SMS for urgent alerts.";
      } else if (hasSlack && hasEmail) {
        return "💡 Recommendation: Use Slack for team alerts and Email for customer notifications or detailed reports.";
      }
    }
    
    if (category === 'database') {
      const hasPostgres = options.some(o => o.id === 'postgresql');
      const hasSupabase = options.some(o => o.id === 'supabase');
      
      if (hasPostgres && hasSupabase) {
        return "💡 Recommendation: Use PostgreSQL for traditional applications, Supabase for modern web apps with real-time features.";
      }
    }
    
    if (category === 'scheduling') {
      const hasSchedule = options.some(o => o.id === 'schedule');
      const hasWebhook = options.some(o => o.id === 'webhook');
      
      if (hasSchedule && hasWebhook) {
        return "💡 Recommendation: Use Schedule for regular automated tasks, Webhook for event-driven workflows.";
      }
    }
    
    return "";
  }
  
  /**
   * Get considerations for category
   */
  private getConsiderations(category: string): string[] {
    const considerations: Record<string, string[]> = {
      notification: [
        "Who needs to receive the notification?",
        "How urgent is the information?",
        "Do recipients need to take action?",
        "Is there existing infrastructure?",
        "What's your budget for notifications?"
      ],
      database: [
        "What's your team's expertise?",
        "Do you need real-time capabilities?",
        "How much data will you store?",
        "What are your performance requirements?",
        "Do you need built-in authentication?"
      ],
      file_storage: [
        "How large are the files?",
        "How many users need access?",
        "Do you need version control?",
        "What's your budget?",
        "Where are your users located?"
      ],
      authentication: [
        "What's your security requirement?",
        "Do users already have accounts?",
        "What's your technical expertise?",
        "Do you need social login?",
        "What's your compliance requirement?"
      ],
      scheduling: [
        "Do you need fixed times or event triggers?",
        "How often will this run?",
        "Do you need manual control?",
        "What timezone should be used?",
        "Is this time-sensitive?"
      ]
    };
    
    return considerations[category] || [];
  }
  
  /**
   * Get user-friendly label
   */
  private getUserFriendlyLabel(name: string): string {
    return name;
  }
  
  /**
   * Get pros for specific node
   */
  private getProsForNode(nodeId: string): string[] {
    const prosMap: Record<string, string[]> = {
      slack: ["Team collaboration", "Rich formatting", "Threads and reactions", "Easy integration"],
      email: ["Universal", "Detailed content", "Attachments", "Professional"],
      discord: ["Free", "Easy setup", "Rich formatting", "Community-friendly"],
      twilio: ["Urgent alerts", "High delivery rate", "Global reach", "Two-way communication"],
      gmail: ["Professional", "Google integration", "Rich formatting", "Familiar interface"],
      postgresql: ["Powerful queries", "ACID compliance", "Mature ecosystem", "Complex relationships"],
      supabase: ["Real-time", "Built-in auth", "Easy setup", "Modern API"],
      mysql: ["Widely used", "Good performance", "Large community", "Proven reliability"],
      s3: ["Scalable", "Cost-effective", "Reliable", "Global CDN"],
      google_drive: ["Collaboration", "Easy sharing", "Google integration", "User-friendly"],
      schedule: ["Precise timing", "Cron support", "Timezone aware", "Reliable"],
      interval: ["Simple", "Flexible", "Easy to understand", "Good for polling"],
      webhook: ["Real-time", "Event-driven", "Efficient", "No polling needed"],
      manual: ["Full control", "Testing friendly", "On-demand", "No scheduling needed"]
    };
    
    return prosMap[nodeId] || [];
  }
  
  /**
   * Get cons for specific node
   */
  private getConsForNode(nodeId: string): string[] {
    const consMap: Record<string, string[]> = {
      slack: ["Requires Slack workspace", "Team-focused", "Limited external access"],
      email: ["Can be filtered as spam", "Less immediate", "Requires SMTP setup"],
      discord: ["Requires Discord server", "Less professional", "Limited business use"],
      twilio: ["Cost per message", "Requires phone numbers", "Character limits"],
      gmail: ["Requires Google account", "OAuth complexity", "Rate limits"],
      postgresql: ["Requires SQL knowledge", "Setup complexity", "Manual scaling"],
      supabase: ["Vendor lock-in", "Limited customization", "Pricing at scale"],
      mysql: ["Less modern features", "Manual scaling", "Configuration complexity"],
      s3: ["AWS dependency", "Learning curve", "Cost at scale"],
      google_drive: ["Google dependency", "OAuth setup", "Storage limits"],
      schedule: ["Less flexible", "Requires cron knowledge", "Timezone complexity"],
      interval: ["Not precise", "Polling overhead", "Resource usage"],
      webhook: ["Requires endpoint", "Security concerns", "Dependency on caller"],
      manual: ["No automation", "Requires user action", "Not scalable"]
    };
    
    return consMap[nodeId] || [];
  }
  
  /**
   * Get best use cases for node
   */
  private getBestUseCases(nodeId: string): string[] {
    const useCasesMap: Record<string, string[]> = {
      slack: ["Team notifications", "Daily standups", "Status updates", "Internal alerts"],
      email: ["Customer notifications", "Reports", "Formal communication", "External users"],
      discord: ["Community updates", "Gaming notifications", "Informal alerts"],
      twilio: ["Urgent alerts", "2FA codes", "Order confirmations", "Emergency notifications"],
      gmail: ["Business emails", "Google Workspace integration", "Professional communication"],
      postgresql: ["Complex queries", "Relational data", "Enterprise applications"],
      supabase: ["Real-time apps", "User management", "Modern web apps", "Quick prototyping"],
      mysql: ["Web applications", "Content management", "E-commerce"],
      s3: ["Large files", "Backups", "Static assets", "Media storage"],
      google_drive: ["Team collaboration", "Document sharing", "Google Workspace"],
      schedule: ["Daily reports", "Regular syncs", "Time-based tasks"],
      interval: ["Polling APIs", "Regular checks", "Simple automation"],
      webhook: ["Real-time events", "API callbacks", "External triggers"],
      manual: ["Testing", "Ad-hoc tasks", "One-time runs"]
    };
    
    return useCasesMap[nodeId] || [];
  }
  
  /**
   * Get complexity rating
   */
  private getComplexityRating(nodeId: string): 'low' | 'medium' | 'high' {
    const complexityMap: Record<string, 'low' | 'medium' | 'high'> = {
      slack: 'low',
      email: 'medium',
      discord: 'low',
      twilio: 'medium',
      gmail: 'medium',
      postgresql: 'high',
      supabase: 'low',
      mysql: 'high',
      s3: 'medium',
      google_drive: 'medium',
      schedule: 'medium',
      interval: 'low',
      webhook: 'low',
      manual: 'low'
    };
    
    return complexityMap[nodeId] || 'medium';
  }
}

// Export singleton instance
export const questionFormatter = new QuestionFormatter();
