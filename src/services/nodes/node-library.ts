// Comprehensive Node Library
// Complete schemas, validation, and AI selection criteria for all node types
// Based on the comprehensive guide

export interface NodeSchema {
  type: string;
  label: string;
  category: string;
  description: string;
  configSchema: ConfigSchema;
  aiSelectionCriteria: AISelectionCriteria;
  commonPatterns: CommonPattern[];
  validationRules: ValidationRule[];
}

export interface ConfigSchema {
  required: string[];
  optional: Record<string, ConfigField>;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'expression';
  description: string;
  default?: any;
  examples?: any[];
  validation?: (value: any) => boolean | string;
}

export interface AISelectionCriteria {
  whenToUse: string[];
  whenNotToUse: string[];
  keywords: string[];
  useCases: string[];
}

export interface CommonPattern {
  name: string;
  description: string;
  config: Record<string, any>;
}

export interface ValidationRule {
  field: string;
  validator: (value: any) => boolean | string;
  errorMessage: string;
}

/**
 * Comprehensive Node Library
 * Provides complete information about all available nodes for AI workflow generation
 */
export class NodeLibrary {
  private schemas: Map<string, NodeSchema> = new Map();

  constructor() {
    this.initializeSchemas();
  }

  /**
   * Get schema for a node type
   */
  getSchema(nodeType: string): NodeSchema | undefined {
    return this.schemas.get(nodeType);
  }

  /**
   * Get all schemas
   */
  getAllSchemas(): NodeSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: string): NodeSchema[] {
    return Array.from(this.schemas.values()).filter(s => s.category === category);
  }

  /**
   * Find nodes matching keywords
   */
  findNodesByKeywords(keywords: string[]): NodeSchema[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    return Array.from(this.schemas.values()).filter(schema => {
      return lowerKeywords.some(keyword =>
        schema.aiSelectionCriteria.keywords.some(k => k.toLowerCase().includes(keyword)) ||
        schema.description.toLowerCase().includes(keyword) ||
        schema.label.toLowerCase().includes(keyword)
      );
    });
  }

  /**
   * Initialize all node schemas
   */
  private initializeSchemas(): void {
    // Trigger Nodes
    this.addSchema(this.createScheduleTriggerSchema());
    this.addSchema(this.createWebhookTriggerSchema());
    this.addSchema(this.createManualTriggerSchema());
    this.addSchema(this.createIntervalTriggerSchema());

    // HTTP & API Nodes
    this.addSchema(this.createHttpRequestSchema());
    this.addSchema(this.createHttpResponseSchema());

    // Database Nodes
    this.addSchema(this.createPostgreSQLSchema());
    this.addSchema(this.createSupabaseSchema());
    this.addSchema(this.createDatabaseReadSchema());
    this.addSchema(this.createDatabaseWriteSchema());

    // Transformation Nodes
    this.addSchema(this.createSetNodeSchema());
    this.addSchema(this.createCodeNodeSchema());
    this.addSchema(this.createDateTimeNodeSchema());

    // Logic Nodes
    this.addSchema(this.createIfElseSchema());
    this.addSchema(this.createSwitchSchema());
    this.addSchema(this.createMergeSchema());

    // Error Handling Nodes
    this.addSchema(this.createErrorHandlerSchema());
    this.addSchema(this.createWaitNodeSchema());

    // Output Nodes
    this.addSchema(this.createSlackMessageSchema());
    this.addSchema(this.createEmailSchema());
    this.addSchema(this.createLogOutputSchema());
  }

  private addSchema(schema: NodeSchema): void {
    this.schemas.set(schema.type, schema);
  }

  // ============================================
  // TRIGGER NODES
  // ============================================

  private createScheduleTriggerSchema(): NodeSchema {
    return {
      type: 'schedule',
      label: 'Schedule Trigger',
      category: 'triggers',
      description: 'Executes workflow on a time-based schedule using cron expressions',
      configSchema: {
        required: ['cron'],
        optional: {
          cron: {
            type: 'string',
            description: 'Cron expression (e.g., "0 9 * * *" for daily at 9 AM)',
            examples: ['0 9 * * *', '*/30 * * * *', '0 0 * * 1'],
          },
          timezone: {
            type: 'string',
            description: 'Timezone for schedule',
            default: 'UTC',
            examples: ['UTC', 'America/New_York', 'Europe/London'],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions time-based execution (daily, hourly, weekly)',
          'Regular/repetitive tasks needed',
          'No external event triggers available',
          'Batch processing requirements',
        ],
        whenNotToUse: [
          'Real-time event processing needed',
          'Workflow triggered by external systems',
          'Manual execution only required',
        ],
        keywords: ['schedule', 'daily', 'hourly', 'weekly', 'cron', 'time', 'every'],
        useCases: ['Daily reports', 'Hourly syncs', 'Scheduled maintenance', 'Periodic data processing'],
      },
      commonPatterns: [
        {
          name: 'daily_at_9am',
          description: 'Run daily at 9 AM',
          config: { cron: '0 9 * * *', timezone: 'UTC' },
        },
        {
          name: 'hourly',
          description: 'Run every hour',
          config: { cron: '0 * * * *', timezone: 'UTC' },
        },
        {
          name: 'business_hours',
          description: 'Run during business hours (8 AM - 5 PM, Mon-Fri)',
          config: { cron: '0 8-17 * * 1-5', timezone: 'UTC' },
        },
      ],
      validationRules: [
        {
          field: 'cron',
          validator: (value) => /^[\d\s\*\/\-\,]+$/.test(value),
          errorMessage: 'Invalid cron expression format',
        },
      ],
    };
  }

  private createWebhookTriggerSchema(): NodeSchema {
    return {
      type: 'webhook',
      label: 'Webhook Trigger',
      category: 'triggers',
      description: 'Executes workflow when HTTP request is received',
      configSchema: {
        required: ['path'],
        optional: {
          path: {
            type: 'string',
            description: 'URL path for webhook',
            examples: ['/webhook', '/api/callback', '/form-submit'],
          },
          httpMethod: {
            type: 'string',
            description: 'HTTP method to accept',
            default: 'POST',
            examples: ['GET', 'POST', 'PUT', 'DELETE'],
          },
          responseMode: {
            type: 'string',
            description: 'How to respond to webhook caller',
            default: 'responseNode',
            examples: ['responseNode', 'onReceived', 'lastNode'],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions "when X happens, do Y"',
          'Real-time processing needed',
          'Integration with external services',
          'Event-driven architecture',
        ],
        whenNotToUse: [
          'Scheduled tasks only',
          'No external system can call webhook',
          'Manual execution sufficient',
        ],
        keywords: ['webhook', 'http', 'api', 'callback', 'event', 'trigger', 'when'],
        useCases: ['API callbacks', 'Form submissions', 'External system integration', 'Real-time events'],
      },
      commonPatterns: [
        {
          name: 'slack_command',
          description: 'Handle Slack slash commands',
          config: { path: '/slack/command', httpMethod: 'POST', responseMode: 'onReceived' },
        },
        {
          name: 'github_webhook',
          description: 'Process GitHub events',
          config: { path: '/github/webhook', httpMethod: 'POST', responseMode: 'responseNode' },
        },
      ],
      validationRules: [
        {
          field: 'path',
          validator: (value) => typeof value === 'string' && value.startsWith('/'),
          errorMessage: 'Path must start with /',
        },
      ],
    };
  }

  private createManualTriggerSchema(): NodeSchema {
    return {
      type: 'manual_trigger',
      label: 'Manual Trigger',
      category: 'triggers',
      description: 'Workflow executes when user manually triggers it',
      configSchema: {
        required: [],
        optional: {
          inputData: {
            type: 'object',
            description: 'Optional input data when triggered manually',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User says "run manually" or "on demand"',
          'No schedule or external trigger needed',
          'Testing purposes',
          'User interaction required',
        ],
        whenNotToUse: [
          'Automated scheduling needed',
          'External event triggers available',
          'Unattended operation required',
        ],
        keywords: ['manual', 'on demand', 'run', 'execute', 'trigger'],
        useCases: ['Ad-hoc processing', 'Testing', 'One-time operations', 'User-initiated tasks'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createIntervalTriggerSchema(): NodeSchema {
    return {
      type: 'interval',
      label: 'Interval Trigger',
      category: 'triggers',
      description: 'Trigger workflow at fixed intervals',
      configSchema: {
        required: ['interval', 'unit'],
        optional: {
          interval: {
            type: 'number',
            description: 'Interval value',
            examples: [1, 5, 30, 60],
          },
          unit: {
            type: 'string',
            description: 'Interval unit',
            examples: ['seconds', 'minutes', 'hours'],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions specific intervals (every 5 minutes, every hour)',
          'More flexible than cron needed',
          'Simple recurring tasks',
        ],
        whenNotToUse: [
          'Complex scheduling needed',
          'Specific times required',
        ],
        keywords: ['interval', 'every', 'repeat', 'periodic'],
        useCases: ['Polling', 'Regular checks', 'Simple recurring tasks'],
      },
      commonPatterns: [
        {
          name: 'every_5_minutes',
          description: 'Run every 5 minutes',
          config: { interval: 5, unit: 'minutes' },
        },
      ],
      validationRules: [],
    };
  }

  // ============================================
  // HTTP & API NODES
  // ============================================

  private createHttpRequestSchema(): NodeSchema {
    return {
      type: 'http_request',
      label: 'HTTP Request',
      category: 'http_api',
      description: 'Makes HTTP requests to external APIs or services',
      configSchema: {
        required: ['url'],
        optional: {
          url: {
            type: 'string',
            description: 'Full URL to request',
            examples: ['https://api.example.com/data', '{{$json.apiUrl}}/users'],
          },
          method: {
            type: 'string',
            description: 'HTTP method',
            default: 'GET',
            examples: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          },
          headers: {
            type: 'object',
            description: 'HTTP headers to send',
            examples: [
              { 'Authorization': 'Bearer {{$credentials.apiKey}}', 'Content-Type': 'application/json' },
            ],
          },
          body: {
            type: 'object',
            description: 'Request body for POST/PUT/PATCH',
          },
          qs: {
            type: 'object',
            description: 'Query string parameters',
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds',
            default: 10000,
          },
          retryOnFail: {
            type: 'boolean',
            description: 'Retry on failure',
            default: true,
          },
          maxRetries: {
            type: 'number',
            description: 'Maximum retry attempts',
            default: 3,
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions API integration',
          'Need to fetch data from web services',
          'Sending data to external systems',
          'Web scraping',
        ],
        whenNotToUse: [
          'Database operations (use database nodes)',
          'File operations (use file nodes)',
          'Simple data transformation (use set/code nodes)',
        ],
        keywords: ['api', 'http', 'request', 'fetch', 'call', 'endpoint', 'url'],
        useCases: ['API integration', 'Data fetching', 'Webhooks', 'External service calls'],
      },
      commonPatterns: [
        {
          name: 'rest_api_get',
          description: 'GET request to REST API',
          config: {
            method: 'GET',
            headers: { 'Authorization': 'Bearer {{$credentials.apiToken}}', 'Accept': 'application/json' },
          },
        },
        {
          name: 'rest_api_post',
          description: 'POST request to create resource',
          config: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {},
          },
        },
      ],
      validationRules: [
        {
          field: 'url',
          validator: (value) => typeof value === 'string' && (value.startsWith('http') || value.includes('{{')),
          errorMessage: 'URL must be valid or an expression',
        },
      ],
    };
  }

  private createHttpResponseSchema(): NodeSchema {
    return {
      type: 'respond_to_webhook',
      label: 'Respond to Webhook',
      category: 'http_api',
      description: 'Sends HTTP response back to webhook caller',
      configSchema: {
        required: [],
        optional: {
          responseCode: {
            type: 'number',
            description: 'HTTP status code',
            default: 200,
            examples: [200, 201, 400, 404, 500],
          },
          headers: {
            type: 'object',
            description: 'Response headers',
            default: { 'Content-Type': 'application/json' },
          },
          body: {
            type: 'object',
            description: 'Response body data',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Workflow triggered by webhook',
          'Need to send response back to caller',
          'Building API endpoints',
          'Form submission handling',
        ],
        whenNotToUse: [
          'Not a webhook-triggered workflow',
          'No response needed',
        ],
        keywords: ['response', 'webhook', 'reply', 'return'],
        useCases: ['Webhook responses', 'API endpoints', 'Form submissions'],
      },
      commonPatterns: [
        {
          name: 'success_response',
          description: 'Return success response',
          config: { responseCode: 200, body: { status: 'success', data: '{{$json}}' } },
        },
      ],
      validationRules: [],
    };
  }

  // ============================================
  // DATABASE NODES
  // ============================================

  private createPostgreSQLSchema(): NodeSchema {
    return {
      type: 'database_write',
      label: 'Database Write',
      category: 'database',
      description: 'Execute SQL queries on PostgreSQL database',
      configSchema: {
        required: ['query'],
        optional: {
          query: {
            type: 'string',
            description: 'SQL query to execute',
            examples: [
              'INSERT INTO users (name, email) VALUES ($1, $2)',
              'UPDATE users SET status = $1 WHERE id = $2',
            ],
          },
          parameters: {
            type: 'array',
            description: 'Query parameters',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions database operations',
          'Need to store data',
          'Complex queries needed',
          'Transaction management',
        ],
        whenNotToUse: [
          'Simple API calls',
          'File operations',
        ],
        keywords: ['database', 'postgres', 'sql', 'insert', 'update', 'delete', 'query'],
        useCases: ['Data storage', 'Complex queries', 'Batch operations', 'Data synchronization'],
      },
      commonPatterns: [
        {
          name: 'insert_with_timestamp',
          description: 'Insert with created_at timestamp',
          config: {
            query: 'INSERT INTO table (columns, created_at) VALUES ($1, NOW()) RETURNING *',
          },
        },
      ],
      validationRules: [
        {
          field: 'query',
          validator: (value) => typeof value === 'string' && value.length > 0,
          errorMessage: 'Query is required',
        },
      ],
    };
  }

  private createSupabaseSchema(): NodeSchema {
    return {
      type: 'supabase',
      label: 'Supabase',
      category: 'database',
      description: 'Interact with Supabase (PostgreSQL + realtime + storage)',
      configSchema: {
        required: ['table', 'operation'],
        optional: {
          table: {
            type: 'string',
            description: 'Table name',
          },
          operation: {
            type: 'string',
            description: 'Operation type',
            examples: ['select', 'insert', 'update', 'delete'],
          },
          data: {
            type: 'object',
            description: 'Data for insert/update',
          },
          filters: {
            type: 'object',
            description: 'Filter conditions',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions Supabase',
          'Modern web app backend',
          'Realtime subscriptions needed',
        ],
        whenNotToUse: [
          'Standard PostgreSQL operations',
          'Other database systems',
        ],
        keywords: ['supabase', 'realtime', 'modern'],
        useCases: ['Modern web apps', 'Realtime data', 'File storage'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createDatabaseReadSchema(): NodeSchema {
    return {
      type: 'database_read',
      label: 'Database Read',
      category: 'database',
      description: 'Read data from database using SQL queries',
      configSchema: {
        required: ['query'],
        optional: {
          query: {
            type: 'string',
            description: 'SELECT query',
            examples: ['SELECT * FROM users WHERE status = $1'],
          },
          parameters: {
            type: 'array',
            description: 'Query parameters',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Need to retrieve data from database',
          'Complex queries needed',
        ],
        whenNotToUse: [
          'Simple data operations',
        ],
        keywords: ['read', 'select', 'fetch', 'get', 'retrieve'],
        useCases: ['Data retrieval', 'Complex queries'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createDatabaseWriteSchema(): NodeSchema {
    return this.createPostgreSQLSchema(); // Same as PostgreSQL for now
  }

  // ============================================
  // TRANSFORMATION NODES
  // ============================================

  private createSetNodeSchema(): NodeSchema {
    return {
      type: 'set_variable',
      label: 'Set Variable',
      category: 'data',
      description: 'Set values on JSON data',
      configSchema: {
        required: ['values'],
        optional: {
          values: {
            type: 'array',
            description: 'Array of field assignments',
            examples: [
              [{ name: 'fullName', value: '{{$json.firstName}} {{$json.lastName}}' }],
            ],
          },
          keepSource: {
            type: 'boolean',
            description: 'Keep original fields',
            default: false,
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Simple data mapping needed',
          'Adding computed fields',
          'Default value assignment',
          'Data normalization',
        ],
        whenNotToUse: [
          'Complex transformations (use code node)',
          'Conditional logic (use if node)',
        ],
        keywords: ['set', 'map', 'transform', 'add field', 'assign'],
        useCases: ['Data mapping', 'Adding fields', 'Normalization'],
      },
      commonPatterns: [
        {
          name: 'add_timestamps',
          description: 'Add created/updated timestamps',
          config: {
            values: [
              { name: 'createdAt', value: '{{$now}}' },
              { name: 'updatedAt', value: '{{$now}}' },
            ],
          },
        },
      ],
      validationRules: [],
    };
  }

  private createCodeNodeSchema(): NodeSchema {
    return {
      type: 'javascript',
      label: 'JavaScript',
      category: 'data',
      description: 'Execute custom JavaScript code',
      configSchema: {
        required: ['code'],
        optional: {
          code: {
            type: 'string',
            description: 'JavaScript code to execute',
            examples: [
              'return { ...$json, fullName: $json.firstName + " " + $json.lastName };',
            ],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Complex data transformations',
          'Custom algorithms',
          'API response processing',
          'Data validation',
        ],
        whenNotToUse: [
          'Simple mappings (use set node)',
          'Conditional logic (use if node)',
        ],
        keywords: ['code', 'javascript', 'transform', 'custom', 'complex'],
        useCases: ['Complex transformations', 'Custom logic', 'Data processing'],
      },
      commonPatterns: [],
      validationRules: [
        {
          field: 'code',
          validator: (value) => typeof value === 'string' && value.length > 0,
          errorMessage: 'Code is required',
        },
      ],
    };
  }

  private createDateTimeNodeSchema(): NodeSchema {
    return {
      type: 'date_time',
      label: 'Date/Time',
      category: 'data',
      description: 'Parse, format, and manipulate dates and times',
      configSchema: {
        required: ['operation'],
        optional: {
          operation: {
            type: 'string',
            description: 'Operation type',
            examples: ['format', 'calculate', 'extract', 'parse'],
          },
          dateValue: {
            type: 'string',
            description: 'Input date',
            examples: ['{{$json.timestamp}}', '{{$now}}'],
          },
          format: {
            type: 'string',
            description: 'Output format',
            examples: ['YYYY-MM-DD', 'HH:mm:ss'],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Date formatting needed',
          'Time zone conversion',
          'Date calculations',
          'Schedule generation',
        ],
        whenNotToUse: [
          'Simple data operations',
        ],
        keywords: ['date', 'time', 'format', 'timestamp', 'schedule'],
        useCases: ['Date formatting', 'Time conversion', 'Calculations'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  // ============================================
  // LOGIC NODES
  // ============================================

  private createIfElseSchema(): NodeSchema {
    return {
      type: 'if_else',
      label: 'If/Else',
      category: 'logic',
      description: 'Conditional branching based on true/false condition',
      configSchema: {
        required: ['conditions'],
        optional: {
          conditions: {
            type: 'array',
            description: 'Conditions to evaluate',
            examples: [
              [{ leftValue: '{{$json.status}}', operation: 'equals', rightValue: 'error' }],
            ],
          },
          combineOperation: {
            type: 'string',
            description: 'How to combine conditions',
            default: 'AND',
            examples: ['AND', 'OR'],
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions "if X then Y"',
          'Conditional logic needed',
          'Error checking',
          'Data validation branching',
        ],
        whenNotToUse: [
          'Multiple paths (use switch)',
          'Simple data flow',
        ],
        keywords: ['if', 'else', 'condition', 'when', 'check'],
        useCases: ['Conditional logic', 'Error handling', 'Validation'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createSwitchSchema(): NodeSchema {
    return {
      type: 'switch',
      label: 'Switch',
      category: 'logic',
      description: 'Multi-path conditional logic based on value matching',
      configSchema: {
        required: ['routingType', 'rules'],
        optional: {
          routingType: {
            type: 'string',
            description: 'Routing type',
            examples: ['expression', 'string', 'number'],
          },
          rules: {
            type: 'array',
            description: 'Routing rules',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Multiple conditional paths',
          'Route based on status codes',
          'Category-based processing',
        ],
        whenNotToUse: [
          'Simple if/else (use if node)',
        ],
        keywords: ['switch', 'route', 'multiple', 'paths'],
        useCases: ['Multi-path logic', 'Routing', 'Status handling'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createMergeSchema(): NodeSchema {
    return {
      type: 'merge',
      label: 'Merge',
      category: 'logic',
      description: 'Merge multiple branches of data',
      configSchema: {
        required: ['mode'],
        optional: {
          mode: {
            type: 'string',
            description: 'Merge mode',
            examples: ['append', 'join', 'passThrough', 'multiples'],
          },
          joinBy: {
            type: 'string',
            description: 'Field to join on (for join mode)',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Combine parallel processing results',
          'Aggregate data from multiple sources',
          'Join related data',
        ],
        whenNotToUse: [
          'Simple data flow',
        ],
        keywords: ['merge', 'combine', 'join', 'aggregate'],
        useCases: ['Combining results', 'Data aggregation', 'Parallel processing'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  // ============================================
  // ERROR HANDLING NODES
  // ============================================

  private createErrorHandlerSchema(): NodeSchema {
    return {
      type: 'error_handler',
      label: 'Error Handler',
      category: 'logic',
      description: 'Handle errors with retry logic and fallback values',
      configSchema: {
        required: [],
        optional: {
          continueOnFail: {
            type: 'boolean',
            description: 'Continue workflow after error',
            default: false,
          },
          retryOnFail: {
            type: 'boolean',
            description: 'Retry failed node',
            default: true,
          },
          maxRetries: {
            type: 'number',
            description: 'Maximum retry attempts',
            default: 3,
          },
          retryDelay: {
            type: 'number',
            description: 'Delay between retries (ms)',
            default: 5000,
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'External API calls present',
          'User mentions "reliable" or "error handling"',
          'Critical workflows',
        ],
        whenNotToUse: [
          'Simple workflows without external calls',
        ],
        keywords: ['error', 'retry', 'handle', 'fail', 'reliable'],
        useCases: ['API error handling', 'Retry logic', 'Graceful degradation'],
      },
      commonPatterns: [
        {
          name: 'api_retry',
          description: 'Retry API calls with exponential backoff',
          config: { retryOnFail: true, maxRetries: 3, retryDelay: 2000 },
        },
      ],
      validationRules: [],
    };
  }

  private createWaitNodeSchema(): NodeSchema {
    return {
      type: 'wait',
      label: 'Wait',
      category: 'logic',
      description: 'Pause workflow execution',
      configSchema: {
        required: ['resumeType'],
        optional: {
          resumeType: {
            type: 'string',
            description: 'How to resume',
            examples: ['timer', 'until', 'webhook'],
          },
          hours: {
            type: 'number',
            description: 'Hours to wait (for timer)',
          },
          minutes: {
            type: 'number',
            description: 'Minutes to wait (for timer)',
          },
          seconds: {
            type: 'number',
            description: 'Seconds to wait (for timer)',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Rate limiting between API calls',
          'Waiting for external events',
          'Scheduled delays',
        ],
        whenNotToUse: [
          'Simple data flow',
        ],
        keywords: ['wait', 'delay', 'rate limit', 'pause'],
        useCases: ['Rate limiting', 'Delays', 'Polling intervals'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  // ============================================
  // OUTPUT NODES
  // ============================================

  private createSlackMessageSchema(): NodeSchema {
    return {
      type: 'slack_message',
      label: 'Slack',
      category: 'output',
      description: 'Send messages to Slack channels or users',
      configSchema: {
        required: ['channel', 'text'],
        optional: {
          channel: {
            type: 'string',
            description: 'Slack channel or user ID',
            examples: ['#general', '@username', '{{$json.channel}}'],
          },
          text: {
            type: 'string',
            description: 'Message text',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions Slack notifications',
          'Team communication needed',
          'Alert notifications',
        ],
        whenNotToUse: [
          'Other notification channels',
        ],
        keywords: ['slack', 'notification', 'message', 'alert'],
        useCases: ['Team notifications', 'Alerts', 'Reports'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createEmailSchema(): NodeSchema {
    return {
      type: 'email',
      label: 'Email',
      category: 'output',
      description: 'Send emails via SMTP',
      configSchema: {
        required: ['to', 'subject', 'text'],
        optional: {
          to: {
            type: 'string',
            description: 'Recipient email address',
          },
          subject: {
            type: 'string',
            description: 'Email subject',
          },
          text: {
            type: 'string',
            description: 'Email body (text)',
          },
          html: {
            type: 'string',
            description: 'Email body (HTML)',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'User mentions email notifications',
          'Email communication needed',
        ],
        whenNotToUse: [
          'Other notification channels',
        ],
        keywords: ['email', 'mail', 'send', 'notify'],
        useCases: ['Email notifications', 'Reports', 'Alerts'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }

  private createLogOutputSchema(): NodeSchema {
    return {
      type: 'log_output',
      label: 'Log Output',
      category: 'output',
      description: 'Log data to console or file',
      configSchema: {
        required: [],
        optional: {
          level: {
            type: 'string',
            description: 'Log level',
            default: 'info',
            examples: ['info', 'warn', 'error', 'debug'],
          },
          message: {
            type: 'string',
            description: 'Log message',
          },
        },
      },
      aiSelectionCriteria: {
        whenToUse: [
          'Debugging needed',
          'Audit logging',
          'Monitoring',
        ],
        whenNotToUse: [
          'Production workflows without logging needs',
        ],
        keywords: ['log', 'debug', 'audit', 'monitor'],
        useCases: ['Debugging', 'Audit trails', 'Monitoring'],
      },
      commonPatterns: [],
      validationRules: [],
    };
  }
}

// Export singleton instance
export const nodeLibrary = new NodeLibrary();
