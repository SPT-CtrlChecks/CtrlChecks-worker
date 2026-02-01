// Node Equivalence Mapper
// Groups nodes by functionality to detect when multiple options exist

export interface NodeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirements: string[];
  nodeType: string; // The actual node type identifier
}

export interface EquivalenceGroup {
  category: string;
  description: string;
  nodes: NodeOption[];
}

export interface MultiNodeDetectionResult {
  category: string;
  description: string;
  options: NodeOption[];
  userFriendlyQuestion: string;
}

/**
 * NodeEquivalenceMapper - Detects when multiple nodes can accomplish the same task
 * 
 * Groups nodes by functionality and helps identify when user preferences should be asked
 */
export class NodeEquivalenceMapper {
  private equivalenceGroups: EquivalenceGroup[] = [
    {
      category: "notification",
      description: "send notifications or alerts",
      nodes: [
        {
          id: "slack",
          name: "Slack Message",
          description: "Send message to Slack channel or user",
          icon: "💬",
          requirements: ["Slack app credentials", "Channel ID or username"],
          nodeType: "slack_message"
        },
        {
          id: "email",
          name: "Email",
          description: "Send email via SMTP or email service",
          icon: "📧",
          requirements: ["Email credentials", "Recipient addresses"],
          nodeType: "email"
        },
        {
          id: "discord",
          name: "Discord Webhook",
          description: "Send message to Discord channel via webhook",
          icon: "🎮",
          requirements: ["Discord webhook URL"],
          nodeType: "discord_webhook"
        },
        {
          id: "twilio",
          name: "SMS (Twilio)",
          description: "Send text message via Twilio",
          icon: "📱",
          requirements: ["Twilio credentials", "Phone numbers"],
          nodeType: "twilio"
        },
        {
          id: "gmail",
          name: "Gmail",
          description: "Send email via Gmail API",
          icon: "📨",
          requirements: ["Google OAuth", "Gmail access"],
          nodeType: "google_gmail"
        }
      ]
    },
    {
      category: "database",
      description: "store or retrieve data from databases",
      nodes: [
        {
          id: "postgresql",
          name: "PostgreSQL",
          description: "Traditional SQL database operations",
          icon: "🐘",
          requirements: ["PostgreSQL connection", "SQL knowledge"],
          nodeType: "database_read" // or database_write
        },
        {
          id: "supabase",
          name: "Supabase",
          description: "Modern PostgreSQL with realtime features",
          icon: "⚡",
          requirements: ["Supabase URL", "API key"],
          nodeType: "supabase"
        },
        {
          id: "mysql",
          name: "MySQL",
          description: "Popular SQL database",
          icon: "🐬",
          requirements: ["MySQL connection"],
          nodeType: "database_read" // or database_write
        }
      ]
    },
    {
      category: "file_storage",
      description: "store or retrieve files",
      nodes: [
        {
          id: "s3",
          name: "AWS S3",
          description: "Cloud object storage on AWS",
          icon: "☁️",
          requirements: ["AWS credentials", "S3 bucket"],
          nodeType: "aws_s3" // if exists
        },
        {
          id: "google_drive",
          name: "Google Drive",
          description: "Cloud file storage via Google",
          icon: "📁",
          requirements: ["Google OAuth", "Drive access"],
          nodeType: "google_drive"
        },
        {
          id: "ftp",
          name: "FTP/SFTP",
          description: "File transfer via FTP or SFTP",
          icon: "📤",
          requirements: ["FTP server credentials"],
          nodeType: "ftp" // if exists
        }
      ]
    },
    {
      category: "scheduling",
      description: "when to run workflows",
      nodes: [
        {
          id: "schedule",
          name: "Fixed Schedule",
          description: "",
          icon: "⏰",
          requirements: ["Time specification", "Timezone"],
          nodeType: "schedule"
        },
        {
          id: "interval",
          name: "Regular Intervals",
          description: "",
          icon: "🔄",
          requirements: ["Interval duration"],
          nodeType: "interval"
        },
        {
          id: "webhook",
          name: "Event Trigger",
          description: "",
          icon: "🎯",
          requirements: ["Webhook endpoint"],
          nodeType: "webhook"
        },
        {
          id: "manual",
          name: "Manual Run",
          description: "",
          icon: "▶️",
          requirements: ["User interface"],
          nodeType: "manual_trigger"
        }
      ]
    },
    {
      category: "authentication",
      description: "user authentication methods",
      nodes: [
        {
          id: "oauth2",
          name: "OAuth 2.0",
          description: "Standard authorization framework",
          icon: "🔑",
          requirements: ["Client ID", "Client Secret", "Redirect URI"],
          nodeType: "oauth2" // if exists
        },
        {
          id: "api_key",
          name: "API Key",
          description: "Simple token-based authentication",
          icon: "🔐",
          requirements: ["API key generation"],
          nodeType: "http_request" // used with API key auth
        },
        {
          id: "basic_auth",
          name: "Basic Auth",
          description: "Username/password authentication",
          icon: "👤",
          requirements: ["Username", "Password storage"],
          nodeType: "http_request" // used with basic auth
        }
      ]
    }
  ];

  /**
   * Detect if user request matches multiple node options
   */
  detectMultiNodeOptions(userPrompt: string): MultiNodeDetectionResult[] {
    const detectionResults: MultiNodeDetectionResult[] = [];
    const lowerPrompt = userPrompt.toLowerCase();
    
    for (const group of this.equivalenceGroups) {
      // Check if user prompt contains keywords for this category
      const categoryKeywords = this.getKeywordsForCategory(group.category);
      const hasMatch = categoryKeywords.some(keyword => 
        lowerPrompt.includes(keyword)
      );
      
      if (hasMatch && group.nodes.length > 1) {
        detectionResults.push({
          category: group.category,
          description: group.description,
          options: group.nodes.map(node => ({
            id: node.id,
            name: node.name,
            description: node.description,
            icon: node.icon,
            requirements: node.requirements,
            nodeType: node.nodeType
          })),
          userFriendlyQuestion: this.generateUserQuestion(group)
        });
      }
    }
    
    return detectionResults;
  }
  
  /**
   * Get keywords that indicate a category
   */
  private getKeywordsForCategory(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      notification: [
        "notify", "notification", "alert", "send", "message", "email", 
        "slack", "sms", "text", "push", "announce", "tell", "inform",
        "report", "remind", "ping"
      ],
      database: [
        "store", "save", "database", "record", "data", "save to",
        "persist", "retrieve", "fetch from", "query", "table", "db",
        "postgres", "mysql", "supabase", "mongodb"
      ],
      file_storage: [
        "file", "upload", "download", "store file", "save file",
        "attachment", "document", "image", "upload to", "cloud",
        "drive", "s3", "storage"
      ],
      authentication: [
        "login", "sign in", "authenticate", "verify", "check user",
        "authorize", "permission", "access control", "secure", "auth"
      ],
      scheduling: [
        "when", "schedule", "daily", "hourly", "weekly", "monthly",
        "trigger", "run", "execute", "start", "begin", "time", "every",
        "at", "cron", "interval", "periodic"
      ]
    };
    
    return keywordMap[category] || [];
  }
  
  /**
   * Generate user-friendly question for node preference
   */
  private generateUserQuestion(group: EquivalenceGroup): string {
    const optionsText = group.nodes
      .map((node, index) => `${node.icon} **${node.name}** - ${node.description}`)
      .join('\n');
    
    return `I can ${group.description} in several ways:\n\n${optionsText}`;
  }

  /**
   * Get equivalence group by category
   */
  getEquivalenceGroup(category: string): EquivalenceGroup | undefined {
    return this.equivalenceGroups.find(g => g.category === category);
  }

  /**
   * Get all equivalence groups
   */
  getAllEquivalenceGroups(): EquivalenceGroup[] {
    return this.equivalenceGroups;
  }

  /**
   * Get node option by ID and category
   */
  getNodeOption(category: string, nodeId: string): NodeOption | undefined {
    const group = this.getEquivalenceGroup(category);
    if (!group) return undefined;
    return group.nodes.find(n => n.id === nodeId);
  }
}

// Export singleton instance
export const nodeEquivalenceMapper = new NodeEquivalenceMapper();
