NODE REFERENCE GUIDE (FULL)

This is the full reference content migrated from the legacy fallback content.

## 1. TRIGGER NODES (8 nodes)
**Purpose**: Start workflow execution

### 1.1 chat_trigger
- **Purpose**: Trigger from chat/AI/UI interactions
- **Properties**: None
- **When to use**: Conversational workflows, chat interfaces, UI-triggered workflows

### 1.2 error_trigger
- **Purpose**: Automatically fire when any node fails
- **Properties**: None
- **When to use**: Error handling workflows, error logging, recovery workflows

### 1.3 interval
- **Purpose**: Run workflow at fixed intervals (recurring)
- **Properties**:
  - Interval (required, text): Format "30s", "5m", "1h" (default: "10m")
- **When to use**: Periodic tasks, polling, scheduled maintenance, recurring operations

### 1.4 manual_trigger
- **Purpose**: Start workflow manually (testing/debugging)
- **Properties**: None
- **When to use**: Manual execution, testing, debugging, one-time operations

### 1.5 schedule
- **Purpose**: Execute at specific times (daily schedule)
- **Properties**:
  - Time (required, time): HH:MM format (default: "09:00")
  - Timezone (required, select): e.g., "Asia/Kolkata", "UTC", "America/New_York"
- **When to use**: Daily scheduled tasks, time-based execution

### 1.6 webhook
- **Purpose**: Trigger from HTTP requests
- **Properties**:
  - Method (required, select): GET, POST, PUT (default: POST)
- **When to use**: External API integrations, webhook receivers
- **Data access**: GET uses {{input.query}}, POST/PUT uses {{input.body}}

### 1.7 workflow_trigger
- **Purpose**: Trigger from another workflow
- **Properties**:
  - Source Workflow ID (required, text)
- **When to use**: Workflow composition, chaining workflows

### 1.8 form
- **Purpose**: Trigger from form submissions (blocks until submission)
- **Properties**:
  - Allow Multiple Submissions (boolean, default: true)
  - Require Authentication (boolean, default: false)
  - Enable CAPTCHA (boolean, default: false)
- **When to use**: User data collection, form-based workflows
- **Data access**: {{input.data}} after submission

---

## 2. CORE LOGIC NODES (10 nodes)
**Purpose**: Control flow and conditional logic

### 2.1 error_handler
- **Purpose**: Handle errors gracefully with retries
- **Properties**:
  - Max Retries (number, default: 3)
  - Retry Delay (ms) (number, default: 1000)
  - Fallback Value (JSON)
- **When to use**: Wrap unreliable operations (API calls, database), need retry logic

### 2.2 filter
- **Purpose**: Filter array items by condition
- **Properties**:
  - Array Expression (required, text): e.g., "{{input.items}}"
  - Filter Condition (required, text): JavaScript condition using "item", e.g., "item.status === 'active'"
- **When to use**: Filter arrays, conditional data selection

### 2.3 if_else
- **Purpose**: Conditional branching (true/false paths)
- **Properties**:
  - Condition (required, text): JavaScript expression, e.g., "{{input.value}} > 10"
- **When to use**: Two-path conditional logic, true/false branching
- **Note**: Connect two output edges (true path and false path)

### 2.4 loop
- **Purpose**: Iterate over array items
- **Properties**:
  - Array Expression (required, text): e.g., "{{input.items}}"
  - Max Iterations (number, default: 100)
- **When to use**: Process each item in array, batch operations
- **Data access**: Current item as {{input.item}} or {{item}}, index as {{input.index}}

### 2.5 merge
- **Purpose**: Merge multiple inputs into one output
- **Properties**:
  - Mode (select): "merge" (merge objects), "append" (append to array), "key_based", "wait_all", "concat" (default: "merge")
  - Merge Key (text): For key-based merge mode
- **When to use**: Combine data from multiple paths, merge parallel branches

### 2.6 noop
- **Purpose**: Pass input through unchanged (pass-through)
- **Properties**: None
- **When to use**: Debugging, workflow organization, placeholder

### 2.7 split_in_batches
- **Purpose**: Split array into smaller batches
- **Properties**:
  - Array Expression (required, text): e.g., "{{input.items}}"
  - Batch Size (required, number, default: 10)
- **When to use**: Process large arrays in chunks, respect rate limits, batch operations

### 2.8 stop_and_error
- **Purpose**: Stop workflow and trigger error
- **Properties**:
  - Error Message (required, text)
  - Error Code (text, optional)
- **When to use**: Validation failures, business rule violations, controlled termination

### 2.9 switch
- **Purpose**: Multiple case branching (switch/case)
- **Properties**:
  - Expression (required, text): Value to match, e.g., "{{input.status}}"
  - Cases (JSON): Array of {"value": "...", "label": "..."}
- **When to use**: Multiple conditional paths, switch-like logic
- **Note**: Connect one output edge per case

### 2.10 wait
- **Purpose**: Pause execution for duration
- **Properties**:
  - Duration (ms) (required, number, default: 1000)
- **When to use**: Rate limiting, delays between operations, waiting

---

## 3. DATA MANIPULATION NODES (16 nodes)
**Purpose**: Transform and manipulate data

### 3.1 aggregate
- **Purpose**: Aggregate operations on arrays (sum, avg, count, min, max)
- **Properties**:
  - Operation (required, select): "sum", "avg", "count", "min", "max" (default: "sum")
  - Field (optional, text): Field name to aggregate (leave empty for direct aggregation)
  - Group By (optional, text): Field to group by before aggregating
- **When to use**: Calculate totals, averages, counts, find min/max values

### 3.2 csv_processor
- **Purpose**: Parse CSV data into structured format
- **Properties**:
  - Delimiter (text, default: ",")
  - Has Header Row (boolean, default: true)
- **When to use**: Parse CSV files, convert CSV to JSON arrays/objects

### 3.3 edit_fields
- **Purpose**: Multiple field operations (set, delete, rename) in one node
- **Properties**:
  - Operations (required, JSON): Array of operations [{"operation": "set", "field": "...", "value": "..."}, {"operation": "delete", "field": "..."}, {"operation": "rename", "field": "...", "newName": "..."}]
- **When to use**: Complex field transformations, multiple operations at once

### 3.4 execute_command
- **Purpose**: Execute system commands (⚠️ SECURITY WARNING: Disabled by default)
- **Properties**:
  - Command (required, text)
  - Enable Execution (boolean, default: false, required: true)
  - Timeout (ms) (number, default: 30000)
- **When to use**: System administration (use with extreme caution, prefer JavaScript node)

### 3.5 function
- **Purpose**: Dataset-level JavaScript code execution
- **Properties**:
  - Function Code (required, textarea): JavaScript code (receives: input, data)
  - Timeout (ms) (number, default: 10000)
- **When to use**: Complex dataset transformations, operations on entire dataset

### 3.6 function_item
- **Purpose**: Per-item JavaScript code execution (for arrays)
- **Properties**:
  - Function Code (required, textarea): JavaScript code (receives: item, index, input)
  - Timeout (ms) (number, default: 5000)
- **When to use**: Transform each item in array, item-level processing

### 3.7 item_lists
- **Purpose**: Convert object to key-value list array
- **Properties**: None
- **When to use**: Iterate over object properties, convert object to array

### 3.8 javascript
- **Purpose**: Run custom JavaScript code (most flexible)
- **Properties**:
  - JavaScript Code (required, textarea): JavaScript code (has access to input)
  - Timeout (ms) (number, default: 5000)
- **When to use**: Complex transformations, calculations, validations, custom logic

### 3.9 json_parser
- **Purpose**: Parse/extract data from JSON using JSONPath
- **Properties**:
  - JSONPath Expression (text): e.g., "$.data.items[*]", "$.users[0].name", "$..email"
- **When to use**: Extract nested data from JSON, parse complex JSON structures

### 3.10 limit
- **Purpose**: Limit array size (keep first N items)
- **Properties**:
  - Limit (required, number, default: 10)
- **When to use**: Pagination, sampling, limiting large datasets

### 3.11 merge_data
- **Purpose**: Combine multiple inputs (data-focused)
- **Properties**:
  - Mode (select): "merge" (merge objects), "append" (append to array), "concat" (concatenate arrays, default: "merge")
- **When to use**: Combine data from multiple paths, merge parallel outputs

### 3.12 rename_keys
- **Purpose**: Rename object keys based on mapping
- **Properties**:
  - Key Mappings (required, JSON): {"oldKey": "newKey", ...}
- **When to use**: API compatibility, data normalization, field renaming

### 3.13 set
- **Purpose**: Set/update field values in objects
- **Properties**:
  - Fields (required, JSON): {"fieldName": "value", ...} (supports templates)
- **When to use**: Add/update fields, data enrichment, value transformation

### 3.14 set_variable
- **Purpose**: Store value in workflow-scoped variable
- **Properties**:
  - Variable Name (required, text): e.g., "userId"
  - Value (required, textarea): Value to store (supports templates)
- **When to use**: Store intermediate values, share data across nodes
- **Access**: Use {{variables.variableName}} in subsequent nodes

### 3.15 sort
- **Purpose**: Sort array items by field or directly
- **Properties**:
  - Field (optional, text): Field name to sort by (leave empty for direct sort)
  - Direction (select): "asc" (default), "desc"
  - Type (select): "auto" (default), "string", "number", "date"
- **When to use**: Sort arrays, order data by field

### 3.16 text_formatter
- **Purpose**: Format text with template variables
- **Properties**:
  - Template (required, textarea): Text with {{variable}} placeholders
- **When to use**: Generate emails, messages, reports, formatted output
- **Example**: "Hello {{input.name}}, your order #{{input.orderId}} has been shipped!"

---

## 4. DATABASE NODES (11 nodes)
**Purpose**: Database operations and queries

### 4.1 database_read ⭐ (Recommended for Supabase)
- **Purpose**: Read from Supabase database tables
- **Properties**:
  - Table Name (required, text)
  - Columns (text, default: "*")
  - Filters (JSON): {"column": "value"}
  - Limit (number, default: 100)
  - Order By (text)
  - Ascending (boolean, default: false)
- **When to use**: Read data from Supabase tables (fully integrated)

### 4.2 database_write ⭐ (Recommended for Supabase)
- **Purpose**: Write to Supabase database tables
- **Properties**:
  - Table Name (required, text)
  - Operation (select): "insert", "update", "upsert", "delete" (default: "insert")
  - Data Template (JSON): {"column": "value"} (supports templates)
  - Match Column (text): For update/upsert operations
- **When to use**: Insert/update/delete data in Supabase tables (fully integrated)

### 4.3 supabase ⭐ (Recommended for Supabase)
- **Purpose**: Query Supabase database (optimized for Supabase)
- **Properties**: Same as postgresql (Operation: "select" or "query", Table Name, SQL Query, Filters, Limit, Order By, Ascending)
- **When to use**: Supabase projects (uses Supabase connection automatically)

### 4.4 postgresql
- **Purpose**: Advanced PostgreSQL database operations
- **Properties**: Operation ("select" or "query"), Table Name (for select), SQL Query (for query), Filters, Limit, Order By, Ascending
- **When to use**: Complex PostgreSQL queries, raw SQL

### 4.5 mysql
- **Purpose**: MySQL database operations
- **Properties**: Operation ("select"), Table Name (required), Filters (JSON), Limit (default: 100)
- **When to use**: MySQL database queries
- **Note**: May require MySQL driver library

### 4.6 mongodb
- **Purpose**: MongoDB database operations
- **Properties**: Operation ("find"), Collection Name (required), Query (JSON, MongoDB syntax), Limit (default: 100)
- **When to use**: MongoDB collections
- **Note**: May require MongoDB driver library

### 4.7 redis
- **Purpose**: Redis cache operations
- **Properties**: Operation ("get", "set", "delete"), Key (required), Value (for set), TTL (seconds, for set)
- **When to use**: Redis cache operations
- **Note**: May require Redis driver library

### 4.8 mssql
- **Purpose**: Microsoft SQL Server operations
- **Properties**: Server, Database, Username, Password (all required), Operation ("select" or "query"), Table Name/SQL Query, Filters, Limit
- **When to use**: SQL Server databases
- **Note**: May require SQL Server driver library

### 4.9 sqlite
- **Purpose**: SQLite database operations
- **Properties**: Database Path (required), Operation ("select" or "query"), Table Name/SQL Query, Filters, Limit
- **When to use**: SQLite databases
- **Note**: May require SQLite driver library

### 4.10 snowflake
- **Purpose**: Snowflake data warehouse operations
- **Properties**: Account, Username, Password, Warehouse, Database (all required), Schema (default: "PUBLIC"), Operation ("select" or "query"), Table Name/SQL Query, Limit
- **When to use**: Snowflake data warehouse
- **Note**: May require Snowflake driver library

### 4.11 timescaledb
- **Purpose**: TimescaleDB time-series database operations
- **Properties**: Host, Database, Username, Password (all required), Port (default: 5432), Operation ("select" or "query"), Table Name/SQL Query, Filters, Limit
- **When to use**: Time-series data operations
- **Note**: May require TimescaleDB driver library

**⭐ Note**: For Supabase projects, prefer `database_read`, `database_write`, or `supabase` nodes (fully integrated, no credentials needed).

---

## 5. HTTP & API NODES (3 nodes)
**Purpose**: HTTP requests and API integrations

### 5.1 http_request ⭐
- **Purpose**: Make HTTP API calls
- **Properties**: URL (required), Method (GET, POST, PUT, PATCH, DELETE, default: GET), Headers (JSON), Body (JSON, for POST/PUT/PATCH), Timeout (ms, default: 30000)
- **When to use**: External API calls, REST API integrations
- **⚠️ IMPORTANT**: Returns data DIRECTLY at root level (not in `input.body`), use `{{input.field}}` not `{{input.body.field}}`

### 5.2 graphql
- **Purpose**: Execute GraphQL queries/mutations
- **Properties**: GraphQL Endpoint (required), Query (required, textarea), Operation Name (text), Variables (JSON), Headers (JSON), Timeout (ms)
- **When to use**: GraphQL API integrations

### 5.3 respond_to_webhook
- **Purpose**: Send custom HTTP response to webhook caller
- **Properties**: Status Code (required, number, default: 200), Response Body (JSON), Custom Headers (JSON)
- **When to use**: Custom webhook responses, return status codes and data

---

## 6. COMMUNICATION NODES (9 nodes)
**Purpose**: Send messages and notifications

### 6.1 http_post
- **Purpose**: Send HTTP POST requests (for webhooks/APIs)
- **Properties**: URL (required), Headers (JSON), Body Template (textarea, supports templates)
- **When to use**: Trigger external webhooks, send data to APIs

### 6.2 slack_message ⭐
- **Purpose**: Send rich-formatted Slack messages
- **Properties**: Webhook URL (required), Channel (text), Bot Name (text), Icon Emoji (text), Message (required, textarea), Blocks (JSON, optional)
- **When to use**: Slack notifications, alerts, rich formatting

### 6.3 slack_webhook
- **Purpose**: Simple Slack webhook (simpler than slack_message)
- **Properties**: Webhook URL (required), Message Text (required, textarea)
- **When to use**: Simple Slack notifications

### 6.4 discord_webhook
- **Purpose**: Send Discord messages
- **Properties**: Webhook URL (required), Message (required, textarea), Username (text), Avatar URL (text)
- **When to use**: Discord notifications

### 6.5 microsoft_teams
- **Purpose**: Send Microsoft Teams messages
- **Properties**: Webhook URL (required), Title (text), Message (required, textarea)
- **When to use**: Enterprise Teams notifications

### 6.6 telegram
- **Purpose**: Send Telegram messages via Bot API
- **Properties**: Bot Token (required), Chat ID (required), Message (required, textarea)
- **When to use**: Telegram notifications

### 6.7 whatsapp_cloud
- **Purpose**: Send WhatsApp Business messages
- **Properties**: Phone Number ID (required), Access Token (required), Recipient Number (required), Message (required, textarea)
- **When to use**: WhatsApp Business messaging

### 6.8 twilio
- **Purpose**: Send SMS via Twilio
- **Properties**: Account SID (required), Auth Token (required), From Number (required), To Number (required), Message (required, textarea)
- **When to use**: SMS notifications

### 6.9 log_output
- **Purpose**: Log data for debugging
- **Properties**: Log Message (required, textarea), Log Level (select: "info", "warn", "error", "debug", default: "info")
- **When to use**: Debugging, workflow monitoring, logging

**Note**: Email sending is handled by `google_gmail` node in Google category.

---

## 7. AI & ML NODES (15 nodes)
**Purpose**: AI-powered operations and machine learning capabilities

### 7.1 openai_gpt ⭐
- **Purpose**: Process with OpenAI GPT models (GPT-4o, GPT-4o Mini, GPT-4 Turbo)
- **Properties**:
  - API Key (required, text): OpenAI API key (starts with `sk-`)
  - Model (select): GPT-4o (default), GPT-4o Mini, GPT-4 Turbo
  - System Prompt (required, textarea): System instructions
  - Temperature (number, default: 0.7): Response randomness (0-2)
  - Memory (number, default: 10): Conversation turns to remember
- **When to use**: Text generation, conversations, AI processing with OpenAI models

### 7.2 anthropic_claude
- **Purpose**: Process with Anthropic Claude models (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
- **Properties**:
  - API Key (required, text): Anthropic API key (starts with `sk-ant-`)
  - Model (select): Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
  - System Prompt (required, textarea): System instructions
  - Temperature (number, default: 0.7)
  - Memory (number, default: 10)
- **When to use**: Text generation and AI processing with Claude models

### 7.3 google_gemini
- **Purpose**: Process with Google Gemini models (Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite)
- **Properties**:
  - API Key (required, text): Google API key (starts with `AIza`)
  - Model (select): Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite
  - System Prompt (required, textarea): System instructions
  - Temperature (number, default: 0.7)
  - Memory (number, default: 10)
- **When to use**: Text generation and AI processing with Gemini models

### 7.4 azure_openai
- **Purpose**: Process with Azure OpenAI Service (GPT models)
- **Properties**:
  - Azure Endpoint (required, text): Azure OpenAI endpoint URL
  - API Key (required, text): Azure API key
  - Deployment Name (required, text): Deployment name in Azure
  - API Version (text, default: "2024-02-15-preview")
  - System Prompt (required, textarea): System instructions
  - Temperature (number, default: 0.7)
  - Memory (number, default: 10)
- **When to use**: Azure OpenAI Service integration, enterprise GPT models

### 7.5 hugging_face
- **Purpose**: Hugging Face Inference API (access to thousands of open-source models)
- **Properties**:
  - API Key (required, text): Hugging Face token (starts with `hf_`)
  - Model ID (required, text): Hugging Face model ID (e.g., "gpt2", "meta-llama/Llama-2-7b-chat-hf")
  - Task (select): Text Generation, Text Classification, Question Answering, Summarization, Translation (default: "text-generation")
  - Parameters (JSON): Model parameters (e.g., {"max_length": 100, "temperature": 0.7})
- **When to use**: Various AI tasks using open-source models, multiple task types

### 7.6 cohere
- **Purpose**: Process with Cohere language models (Command, Command Light, Command R, Command R+)
- **Properties**:
  - API Key (required, text): Cohere API key
  - Model (select): Command (default), Command Light, Command R, Command R+
  - Prompt (required, textarea): Prompt text
  - Temperature (number, default: 0.7)
- **When to use**: Text generation with Cohere models

### 7.7 ollama
- **Purpose**: Run local LLMs via Ollama (self-hosted)
- **Properties**:
  - Ollama Server URL (required, text): Set via OLLAMA_BASE_URL environment variable or node config
  - Model Name (required, text, default: "llama2"): e.g., "llama2", "mistral", "codellama"
  - Prompt (required, textarea): Prompt text
  - Temperature (number, default: 0.7)
- **When to use**: Privacy-sensitive applications, local LLM execution
- **Note**: Requires Ollama server running

### 7.8 text_summarizer
- **Purpose**: Summarize text using AI
- **Properties**:
  - API Key (required, text): OpenAI API key (starts with `sk-`)
  - Memory (number, default: 10): Conversation turns to remember
- **When to use**: Condensing articles, documents, conversations, text summarization

### 7.9 sentiment_analyzer
- **Purpose**: Analyze text sentiment (positive, negative, neutral)
- **Properties**:
  - API Key (required, text): OpenAI API key (starts with `sk-`)
  - Memory (number, default: 10)
- **When to use**: Social media monitoring, feedback analysis, customer sentiment tracking

### 7.10 memory
- **Purpose**: Store/retrieve conversation memory for chatbots
- **Properties**:
  - Operation (required, select): Store, Retrieve, Clear, Search
  - Memory Type (select): Short-term (Redis), Long-term (Vector), Both (Hybrid, default: "both")
  - TTL (seconds) (number, default: 3600): Time to live for short-term memory
  - Max Messages (number, default: 100): Maximum messages to retrieve
- **When to use**: Conversation memory, chatbot context, multi-turn conversations

### 7.11 llm_chain
- **Purpose**: Chain multiple AI prompts together (sequential processing)
- **Properties**:
  - API Key (required, text): OpenAI API key
  - Default Model (select): GPT-4o (default), GPT-4o Mini, Claude 3.5 Sonnet, Gemini 2.5 Flash
  - Chain Steps (required, JSON): Array of steps [{"prompt": "Step 1"}, {"prompt": "Step 2", "model": "optional-model"}]
- **When to use**: Multi-step reasoning, complex workflows, sequential AI processing

### 7.12 ai_agent
- **Purpose**: Autonomous AI agent with tool usage
- **Properties**:
  - API Key (required, text): API key (OpenAI, Anthropic, or Gemini)
  - Model (required, select): GPT-4o (default), GPT-4o Mini, Claude 3.5 Sonnet, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite, Gemini Pro
  - Agent Prompt (required, textarea): Instructions for the agent
  - Tools (JSON): Available tools [{"name": "search", "description": "..."}]
  - Max Iterations (number, default: 5): Maximum reasoning steps
  - Temperature (number, default: 0.7)
- **When to use**: Autonomous task execution, tool-using agents, complex reasoning

### 7.13 chat_model
- **Purpose**: Unified LLM provider interface (switch between providers)
- **Properties**:
  - Provider (required, select): OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI (default: "openai")
  - API Key (required, text): Provider API key
  - Model (required, text, default: "gpt-4o"): Model name
  - Endpoint (text): Azure endpoint URL (required for Azure provider)
  - Deployment Name (text): Azure deployment name (required for Azure provider)
  - System Prompt (required, textarea): System instructions
  - Temperature (number, default: 0.7)
- **When to use**: Switch between LLM providers, unified interface for multiple providers

### 7.14 embeddings
- **Purpose**: Generate text embeddings/vectors for semantic search
- **Properties**:
  - Provider (required, select): OpenAI (default), Google (Gemini)
  - API Key (required, text): Provider API key
  - Model (text, default: "text-embedding-ada-002"): OpenAI: text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large
  - Text to Embed (textarea): Text to convert (leave empty to use input)
  - Dimensions (number): Vector dimensions (for text-embedding-3 models, optional: 256, 512, 1024)
- **When to use**: Semantic search, similarity matching, vector databases, RAG applications

### 7.15 vector_store
- **Purpose**: Store and search vector embeddings in vector databases
- **Properties**:
  - Provider (required, select): Pinecone (default), Supabase (pgvector)
  - API Key (required, text): Pinecone API key or Supabase project API key
  - Index Name (required, text): Vector index/database name
  - Operation (required, select): Upsert (default), Query, Delete
  - Vectors (JSON): Vectors to store [{"id": "1", "values": [...]}] (for upsert)
  - Query Vector (JSON): Query vector {"vector": [...], "topK": 5} (for query)
  - IDs (JSON array): Vector IDs to delete ["id1", "id2"] (for delete)
- **When to use**: Semantic search, RAG applications, vector database operations

---

## 8-13. OTHER CATEGORIES - Quick Reference

## 8. FILE & STORAGE NODES (9 nodes)
**Purpose**: File operations and cloud storage

**Note**: Google Drive is in the Google category. Some nodes (FTP, SFTP, AWS S3, MinIO) may require additional client libraries. Dropbox, OneDrive, and Box are fully functional with OAuth tokens.

### 8.1 read_binary_file ⭐
- **Purpose**: Read files from local filesystem
- **Properties**:
  - File Path (required, text): Path to file (supports template variables, e.g., {{input.path}})
  - Max Size (bytes) (number, default: 10485760): Maximum file size in bytes (10MB default)
- **When to use**: Reading configuration files, data files, uploaded files
- **Returns**: File content as base64-encoded string or text
- **Note**: Paths are normalized by the backend runtime

### 8.2 write_binary_file ⭐
- **Purpose**: Write files to local filesystem
- **Properties**:
  - File Path (required, text): Path where file should be written
  - Content (Base64) (required, textarea): File content as base64-encoded string
- **When to use**: Saving data, generating reports, creating temporary files
- **Returns**: File path where file was written
- **Note**: Content must be base64-encoded. Paths are typically written under /tmp/

### 8.3 dropbox ⭐ (Fully functional)
- **Purpose**: Dropbox cloud storage operations
- **Properties**:
  - Access Token (required, text): Dropbox OAuth access token
  - Operation (required, select): "read" (default - Download), "upload" (Upload), "list" (List files), "delete" (Delete)
  - File Path (required, text): Dropbox file path (e.g., "/Documents/file.txt")
  - Content (textarea): File content to upload (required for upload operation)
- **When to use**: Dropbox file operations (fully functional with OAuth token)
- **Returns**: File content (read), file info (upload/list), or success status (delete)

### 8.4 onedrive ⭐ (Fully functional)
- **Purpose**: Microsoft OneDrive cloud storage operations
- **Properties**:
  - Access Token (required, text): Microsoft Graph API access token
  - Operation (required, select): "read" (default - Download), "upload" (Upload), "list" (List files), "delete" (Delete)
  - File ID (text): OneDrive file ID (for read/delete, alternative to File Path)
  - File Path (text): OneDrive file path (alternative to File ID)
  - File Name (text): Name for uploaded file (required for upload)
  - Content (textarea): File content to upload (required for upload)
- **When to use**: OneDrive file operations (fully functional with Microsoft Graph API token)
- **Returns**: File content (read), file info (upload/list), or success status (delete)

### 8.5 box ⭐ (Fully functional)
- **Purpose**: Box.com cloud storage operations
- **Properties**:
  - Access Token (required, text): Box OAuth access token
  - Operation (required, select): "read" (default - Download), "upload" (Upload), "list" (List files), "delete" (Delete)
  - File ID (text): Box file ID (for read/delete operations)
  - File Name (text): Name for uploaded file (required for upload)
  - Content (textarea): File content to upload (required for upload)
  - Folder ID (text, default: "0"): Folder ID for upload/list operations (0 = root folder)
- **When to use**: Box file operations (fully functional with OAuth token)
- **Returns**: File content (read), file info (upload/list), or success status (delete)

### 8.6 aws_s3
- **Purpose**: Amazon S3 bucket operations
- **Properties**:
  - Access Key ID (required, text): AWS access key ID
  - Secret Access Key (required, text): AWS secret access key
  - Region (required, text, default: "us-east-1"): AWS region
  - Bucket Name (required, text): S3 bucket name
  - Operation (required, select): "get" (default - Get Object), "put" (Put Object), "list" (List Objects), "delete" (Delete Object)
  - Object Key (Path) (text): S3 object key/path (required for get/put/delete)
  - Content (textarea): File content to upload (required for put, can be text or base64)
  - Prefix (text): Prefix for listing objects (for list operation)
- **When to use**: AWS S3 file operations
- **Note**: May require AWS SDK configuration

### 8.7 ftp
- **Purpose**: FTP file transfer operations
- **Properties**:
  - Host (required, text): FTP server hostname
  - Port (number, default: 21): FTP server port
  - Username (required, text): FTP username
  - Password (required, text): FTP password
  - Operation (required, select): "get" (default - Get File), "put" (Put File), "list" (List Files), "delete" (Delete File)
  - Remote Path (required, text): File path on FTP server
  - Content (textarea): File content to upload (required for put)
- **When to use**: FTP file transfer operations
- **Note**: May require FTP client library configuration

### 8.8 sftp
- **Purpose**: SFTP secure file transfer operations (SSH encryption)
- **Properties**:
  - Host (required, text): SFTP server hostname
  - Port (number, default: 22): SFTP server port (SSH port)
  - Username (required, text): SFTP username
  - Password (text): SFTP password (use password or private key)
  - Private Key (SSH) (textarea): SSH private key (alternative to password, more secure)
  - Operation (required, select): "get" (default - Get File), "put" (Put File), "list" (List Files), "delete" (Delete File)
  - Remote Path (required, text): File path on SFTP server
  - Content (textarea): File content to upload (required for put)
- **When to use**: Secure file transfer (more secure than FTP)
- **Note**: May require SFTP/SSH client library configuration. Use either Password or Private Key.

### 8.9 minio
- **Purpose**: MinIO object storage operations (S3-compatible, self-hosted)
- **Properties**:
  - Endpoint (required, text): MinIO server endpoint (e.g., "localhost:9000")
  - Access Key (required, text): MinIO access key
  - Secret Key (required, text): MinIO secret key
  - Bucket Name (required, text): MinIO bucket name
  - Operation (required, select): "get" (default - Get Object), "put" (Put Object), "list" (List Objects), "delete" (Delete Object)
  - Object Key (Path) (text): Object key/path in bucket (required for get/put/delete)
  - Content (textarea): Object content to upload (required for put, can be text or base64)
  - Use SSL (boolean, default: false): Enable SSL/TLS
- **When to use**: Self-hosted object storage, S3-compatible storage
- **Note**: May require S3-compatible client library configuration

**⭐ Note**: For cloud storage, prefer Dropbox, OneDrive, or Box (fully functional). Google Drive is in Google category.

## 9. GOOGLE NODES (8 nodes)
**Purpose**: Google Workspace and Cloud integrations

**Note**: All Google nodes require OAuth2 authentication. Users must authenticate with their Google account before using these nodes.

### 9.1 google_gmail ⭐
- **Purpose**: Send and search Gmail messages
- **Properties**:
  - Operation (required, select): "send" (default - Send Email), "list" (List Messages), "get" (Get Message), "search" (Search Messages)
  - To (text): Recipient email address (required for send, supports templates)
  - Subject (text): Email subject (required for send, supports templates)
  - Body (textarea): Email body content (required for send, supports HTML and templates, e.g., {{input.content}})
  - Message ID (text): Gmail message ID (required for get)
  - Search Query (text): Gmail search query (for list/search, e.g., "from:email", "subject:text", "is:unread", "has:attachment")
  - Max Results (number, default: 10): Maximum messages to return
- **When to use**: Sending emails, listing/searching messages, getting message details
- **Returns**: Message data or success status

### 9.2 google_sheets ⭐
- **Purpose**: Read/write Google Sheets spreadsheets
- **Properties**:
  - Operation (required, select): "read" (default - Read), "write" (Write), "append" (Append), "update" (Update)
  - Spreadsheet ID (required, text): Google Sheets spreadsheet ID (from URL between /d/ and /edit)
  - Sheet Name (text): Sheet/tab name (leave empty for first sheet)
  - Range (text): Cell range (e.g., "A1:D100", leave empty to read all used cells)
  - Output Format (select): "json" (default - JSON Array), "key-value" (Key-Value Pairs), "text" (Plain Text Table)
  - Read Direction (select): "rows" (default - Row-wise), "columns" (Column-wise)
  - Allow Write Access (boolean, default: false): ⚠️ Admin only: Enable write/update operations
  - Data (textarea/JSON): Data to write/append/update (JSON array format, leave empty to use input.values from JavaScript)
- **When to use**: Reading/writing spreadsheet data, appending rows, updating ranges
- **⚠️ IMPORTANT**:
  - Read returns array-of-arrays format `[[headers], [row1], ...]`. Parse with JavaScript: `const headers = input.data[0]; const rows = input.data.slice(1);`
  - Use "append" (not "write") when user says "append", "add to", "store in", "save to"
  - For write/append/update: JavaScript should return `{values: [[row1], [row2], ...]}`. Leave Data empty to use input from previous node.
- **Returns**: Spreadsheet data or success status

### 9.3 google_drive ⭐
- **Purpose**: Manage Google Drive files (list, upload, download, delete)
- **Properties**:
  - Operation (required, select): "list" (default - List Files), "upload" (Upload File), "download" (Download File), "delete" (Delete File)
  - Folder ID (text): Google Drive folder ID (for list operation, leave empty for root)
  - File ID (text): Google Drive file ID (required for download/delete, get from URL /file/d/FILE_ID/view)
  - File Name (text): File name for upload (required for upload)
  - File Content (Base64) (textarea): Base64 encoded file content (required for upload)
- **When to use**: File operations in Google Drive, folder navigation
- **Returns**: File list (list), file metadata (upload), file content base64 (download), or success status (delete)

### 9.4 google_calendar ⭐
- **Purpose**: Manage Google Calendar events
- **Properties**:
  - Operation (required, select): "list" (default - List Events), "create" (Create Event), "update" (Update Event), "delete" (Delete Event)
  - Calendar ID (text, default: "primary"): Google Calendar ID (use "primary" for main calendar)
  - Event ID (text): Calendar event ID (required for update/delete)
  - Event Title (text): Event title/summary (required for create/update, supports templates)
  - Start Time (ISO 8601) (text): Event start time (required for create/update, format: YYYY-MM-DDTHH:mm:ssZ)
  - End Time (ISO 8601) (text): Event end time (required for create/update, format: YYYY-MM-DDTHH:mm:ssZ)
- **When to use**: Managing calendar events, scheduling, event CRUD operations
- **⚠️ IMPORTANT**: Times must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ for UTC, or with timezone offset)
- **Returns**: Event data or success status

### 9.5 google_contacts ⭐
- **Purpose**: Manage Google Contacts
- **Properties**:
  - Operation (required, select): "list" (default - List Contacts), "create" (Create Contact), "update" (Update Contact), "delete" (Delete Contact)
  - Contact ID (text): Google Contacts contact ID (resourceName, required for update/delete, format: "people/c1234567890" or just "c1234567890")
  - Name (text): Contact name (required for create/update)
  - Email (text): Contact email address (required for create/update)
  - Phone (text): Contact phone number (include country code, e.g., "+1234567890")
  - Max Results (number, default: 100): Maximum contacts to return
- **When to use**: Contact management, synchronization, CRUD operations
- **⚠️ IMPORTANT**: Contact ID is the resourceName field (format: "people/c1234567890"). Use full resourceName or just ID part.
- **Returns**: Contact data or success status

### 9.6 google_doc ⭐
- **Purpose**: Read/create/update Google Docs documents
- **Properties**:
  - Operation (required, select): "read" (default - Read), "create" (Create), "update" (Update)
  - Document ID or URL (text): Google Docs document ID or full URL (required for read/update, leave empty for create)
  - Document Title (text): Document title (required for create)
  - Content (textarea): Document content (required for create/update, supports templates)
- **When to use**: Reading document text, creating documents, updating content
- **⚠️ IMPORTANT**:
  - Read operation extracts ALL text from document. Returns `{documentId, title, content, text, body}` (all text fields contain same extracted text)
  - Use `{{input.content}}`, `{{input.text}}`, or `{{input.body}}` in templates (all same)
  - Update appends content to beginning of document
- **Returns**: Document data with extracted text (read), document info (create), or updated data (update)

### 9.7 google_tasks ⭐
- **Purpose**: Manage Google Tasks
- **Properties**:
  - Operation (required, select): "list" (default - List Tasks), "create" (Create Task), "update" (Update Task), "complete" (Complete Task)
  - Task List ID (text, default: "@default"): Google Tasks task list ID (use "@default" for default list)
  - Task ID (text): Task ID (required for update/complete)
  - Task Title (text): Task title (required for create/update, supports templates)
  - Notes (textarea): Task notes (supports templates)
  - Due Date (ISO 8601) (text): Task due date (format: YYYY-MM-DDTHH:mm:ssZ)
- **When to use**: Task management, to-do lists, task CRUD operations
- **Returns**: Task data or success status

### 9.8 google_bigquery ⭐
- **Purpose**: Execute SQL queries on Google BigQuery datasets
- **Properties**:
  - Project ID (required, text): Google Cloud Project ID
  - Dataset ID (required, text): BigQuery Dataset ID
  - SQL Query (required, textarea): SQL query to execute (use backticks for table names: `project.dataset.table`)
  - Use Legacy SQL (boolean, default: false): Enable legacy SQL syntax (default: Standard SQL)
- **When to use**: Data analysis, reporting, data warehousing operations
- **Returns**: Query results as array of objects (rows with column values)

## 10. CRM NODES (8 nodes)
**Purpose**: Customer Relationship Management and marketing integrations

**Note**: All CRM nodes require API keys or OAuth2 tokens from their respective providers.

### 10.1 hubspot
- **Purpose**: HubSpot CRM operations (contacts, companies, deals, tickets, products, etc.)
- **Properties**:
  - Authentication Type (required, select): "apikey" (default - API Key), "oauth2" (OAuth2 Access Token)
  - API Key (text): HubSpot API key (required if using API Key authentication)
  - OAuth2 Access Token (text): OAuth2 access token (required if using OAuth2 authentication)
  - Resource (required, select): Contact (default), Company, Deal, Ticket, Product, Line Item, Quote, Call, Email, Meeting, Note, Task, Owner, Pipeline
  - Operation (required, select): "get" (default - Get), "getMany" (Get Many), "create" (Create), "update" (Update), "delete" (Delete), "search" (Search), "batchCreate" (Batch Create), "batchUpdate" (Batch Update), "batchDelete" (Batch Delete)
  - Resource ID (text): Resource ID (required for get, update, delete)
  - Properties (JSON): Resource properties (required for create/update, e.g., {"email": "test@example.com", "firstname": "John"})
  - Search Query (text): Search query (required for search, e.g., "email:test@example.com")
  - Limit (number, default: 100): Maximum records to return
  - After (text): Pagination token
- **When to use**: Comprehensive CRM operations, batch processing, HubSpot integrations
- **Returns**: Resource data or success status

### 10.2 salesforce
- **Purpose**: Salesforce CRM operations (accounts, contacts, leads, opportunities, cases, custom objects)
- **Properties**:
  - Instance URL (required, text): Salesforce instance URL (e.g., "https://yourinstance.salesforce.com")
  - OAuth2 Access Token (required, text): OAuth2 access token
  - Resource/Object (required, select): Contact (default), Account, Lead, Opportunity, Case, Campaign, Product (Product2), Task, Event, Custom Object
  - Custom Object API Name (text): Custom object API name (required if Resource is Custom Object, e.g., "CustomObject__c")
  - Operation (required, select): "query" (default - Query SOQL), "search" (Search SOSL), "get" (Get), "create" (Create), "update" (Update), "delete" (Delete), "upsert" (Upsert), "bulkCreate" (Bulk Create), "bulkUpdate" (Bulk Update), "bulkDelete" (Bulk Delete), "bulkUpsert" (Bulk Upsert)
  - SOQL Query (textarea): SOQL query (required for query, e.g., "SELECT Id, Name, Email FROM Contact LIMIT 10")
  - SOSL Search Query (text): SOSL search query (required for search, e.g., "FIND {test@example.com} IN EMAIL FIELDS RETURNING Contact(Id, Name)")
  - Record ID (text): Salesforce record ID (required for get, update, delete)
  - External ID Field (text): External ID field name (required for upsert)
  - External ID Value (text): External ID value (required for upsert)
  - Fields (JSON): Object fields (required for create/update, e.g., {"LastName": "Doe", "Email": "test@example.com"})
  - Records Array (JSON): Array of records for bulk operations (required for bulk operations)
- **When to use**: Salesforce CRM operations, SOQL/SOSL queries, bulk operations
- **Returns**: Query results, record data, or success status

### 10.3 zoho_crm
- **Purpose**: Zoho CRM operations (contacts, leads, accounts, deals, campaigns, etc.)
- **Properties**:
  - OAuth2 Access Token (required, text): OAuth2 access token
  - API Domain (required, select): US (default - https://www.zohoapis.com), EU, IN, CN, AU, JP (select your region)
  - Module (required, select): Contacts (default), Leads, Accounts, Deals, Campaigns, Tasks, Events, Calls, Products, Quotes, Sales Orders, Invoices, Custom Module
  - Custom Module API Name (text): Custom module API name (required if Module is Custom Module)
  - Operation (required, select): "get" (default - Get), "getMany" (Get Many), "create" (Create), "update" (Update), "delete" (Delete), "search" (Search), "upsert" (Upsert), "bulkCreate" (Bulk Create), "bulkUpdate" (Bulk Update)
  - Record ID (text): Record ID (required for get, update, delete)
  - Data (JSON): Record data (required for create/update, e.g., {"First_Name": "John", "Last_Name": "Doe", "Email": "test@example.com"})
  - Search Criteria (text): Search criteria (required for search, e.g., "(Email:equals:test@example.com)")
  - Fields (comma-separated) (text): Fields to retrieve (e.g., "id,First_Name,Last_Name,Email")
  - Page Number (number, default: 1): Page number for pagination
  - Records Per Page (number, default: 200): Number of records per page (max 200)
- **When to use**: Zoho CRM operations, multi-region support, module operations
- **Returns**: Module data or success status

### 10.4 pipedrive
- **Purpose**: Pipedrive CRM operations (persons, organizations, deals, notes, activities, products, pipelines)
- **Properties**:
  - API Token (required, text): Pipedrive API token
  - Company Domain (required, text): Pipedrive company domain (without .pipedrive.com)
  - Resource (required, select): Person (default), Organization, Deal, Note, Activity, Product, Pipeline, Stage, User
  - Operation (required, select): "get" (default - Get), "getMany" (Get Many), "create" (Create), "update" (Update), "delete" (Delete), "search" (Search)
  - ID (text): Resource ID (required for get, update, delete)
  - Data (JSON): Resource data (required for create/update, e.g., {"name": "John Doe", "email": "test@example.com"})
  - Search Query (text): Search query (required for search)
  - Limit (number, default: 100): Maximum records to return
  - Start (number, default: 0): Starting offset for pagination
- **When to use**: Sales pipeline management, Pipedrive integrations
- **Returns**: Resource data or success status

### 10.5 freshdesk
- **Purpose**: Freshdesk support operations (tickets, contacts, companies, agents, groups, time entries)
- **Properties**:
  - API Key (required, text): Freshdesk API key
  - Domain (required, text): Freshdesk domain (without .freshdesk.com)
  - Resource (required, select): Ticket (default), Contact, Company, Agent, Group, Time Entry
  - Operation (required, select): "list" (default - List), "get" (Get), "create" (Create), "update" (Update), "delete" (Delete), "search" (Search)
  - Resource ID (text): Resource ID (required for get, update, delete)
  - Data (JSON): Resource data (required for create/update, e.g., {"subject": "Ticket Subject", "description": "Description", "email": "test@example.com", "priority": 1, "status": 2})
  - Search Query (text): Search query (required for search, e.g., "email:test@example.com")
  - Page Number (number, default: 1): Page number for pagination
  - Records Per Page (number, default: 30): Number of records per page
- **When to use**: Customer support operations, helpdesk management, ticket management
- **Returns**: Resource data or success status

### 10.6 intercom
- **Purpose**: Intercom conversational CRM (contacts, conversations, messages, tags, segments, companies, events)
- **Properties**:
  - Access Token (required, text): Intercom access token
  - Resource (required, select): Contact (default), Conversation, Message, Tag, Segment, Company, Event
  - Operation (required, select): "get" (default - Get), "list" (List), "create" (Create), "update" (Update), "delete" (Delete), "search" (Search)
  - Resource ID (text): Resource ID (required for get, update, delete)
  - Data (JSON): Resource data (required for create/update, e.g., {"email": "test@example.com", "name": "John Doe"})
  - Search Query (text): Search query (required for search, e.g., "email:test@example.com")
  - Records Per Page (number, default: 50): Number of records per page
  - Starting After (text): Pagination token
- **When to use**: Customer communication, engagement, conversational CRM
- **Returns**: Resource data or success status

### 10.7 mailchimp
- **Purpose**: Mailchimp email marketing (audiences/lists, members, campaigns, automations, segments)
- **Properties**:
  - API Key (required, text): Mailchimp API key
  - Data Center (required, text): Mailchimp data center (e.g., "us1", "us2", "eu1")
  - Resource (required, select): Audience/List (default), Member, Campaign, Automation, Segment
  - Operation (required, select): "list" (default - List), "get" (Get), "create" (Create), "update" (Update), "delete" (Delete), "addMember" (Add Member), "updateMember" (Update Member), "deleteMember" (Delete Member)
  - List/Audience ID (text): List/Audience ID (required for member operations and get/update/delete audience)
  - Member Email (text): Member email address (required for member operations)
  - Data (JSON): Resource data (required for create/update, e.g., {"name": "My List", "contact": {"company": "Company", "address1": "Address"}})
  - Member Data (JSON): Member data (required for add/update member, e.g., {"email_address": "test@example.com", "status": "subscribed", "merge_fields": {"FNAME": "John", "LNAME": "Doe"}})
  - Count (number, default: 10): Number of records to return
  - Offset (number, default: 0): Offset for pagination
- **When to use**: Email marketing, audience management, member management
- **Returns**: Resource data or success status

### 10.8 activecampaign
- **Purpose**: ActiveCampaign automation CRM (contacts, lists, automations, campaigns, deals, tags, custom fields)
- **Properties**:
  - API Key (required, text): ActiveCampaign API key
  - API URL (required, text): ActiveCampaign API URL (e.g., "https://youraccount.api-us1.com")
  - Resource (required, select): Contact (default), List, Automation, Campaign, Deal, Tag, Custom Field
  - Operation (required, select): "get" (default - Get), "list" (List), "create" (Create), "update" (Update), "delete" (Delete), "sync" (Sync), "tagContact" (Tag Contact), "untagContact" (Untag Contact)
  - Resource ID (text): Resource ID (required for get, update, delete)
  - Email (text): Contact email address (required for contact sync and tag operations)
  - Data (JSON): Resource data (required for create/update, e.g., {"email": "test@example.com", "firstName": "John", "lastName": "Doe"})
  - Tag ID (text): Tag ID (required for tag/untag operations)
  - Limit (number, default: 100): Maximum records to return
  - Offset (number, default: 0): Offset for pagination
- **When to use**: Marketing automation, CRM operations, contact management, tagging
- **Returns**: Resource data or success status

## 11. DEVOPS NODES (8 nodes)
**Purpose**: Development operations and infrastructure management

**Note**: All DevOps nodes require authentication credentials (tokens, API keys, or certificates) from their respective providers.

### 11.1 github ⭐
- **Purpose**: GitHub API integration (repositories, issues, pull requests, branches, commits, releases, workflows)
- **Properties**:
  - GitHub Token (required, text): GitHub personal access token (starts with `ghp_`)
  - Operation (required, select): "get_repo" (default - Get Repository), "list_repos" (List Repositories), "create_issue" (Create Issue), "update_issue" (Update Issue), "close_issue" (Close Issue), "list_issues" (List Issues), "get_issue" (Get Issue), "add_issue_comment" (Add Issue Comment), "create_pr" (Create Pull Request), "update_pr" (Update Pull Request), "merge_pr" (Merge Pull Request), "list_prs" (List Pull Requests), "get_pr" (Get Pull Request), "add_pr_comment" (Add PR Comment), "create_branch" (Create Branch), "list_branches" (List Branches), "get_branch" (Get Branch), "delete_branch" (Delete Branch), "create_commit" (Create Commit), "list_commits" (List Commits), "get_commit" (Get Commit), "create_release" (Create Release), "list_releases" (List Releases), "get_release" (Get Release), "get_workflow_runs" (Get Workflow Runs), "trigger_workflow" (Trigger Workflow), "list_contributors" (List Contributors)
  - Owner/Organization (text): GitHub username or organization
  - Repository (text): Repository name
  - Title (text): Issue/PR title (required for create_issue, create_pr)
  - Body (textarea): Issue/PR description (required for create_issue, create_pr)
  - Workflow ID (text): GitHub Actions workflow filename (for trigger_workflow)
  - Branch/Ref (text, default: "main"): Branch name
  - Issue Number (number): GitHub issue number
  - Pull Request Number (number): GitHub PR number
  - State (select): "open" (default), "closed" (for issue state)
  - Comment (textarea): Comment text (required for add_issue_comment, add_pr_comment)
  - Merge Method (select): "merge" (default), "squash", "rebase" (for PR merge)
  - Branch Name (text): Branch name for branch operations
  - SHA/Commit Hash (text): Git commit SHA (40 characters)
  - Commit Message (textarea): Commit message (required for create_commit)
  - File Path (text): File path (for create_commit)
  - File Content (textarea): File content (for create_commit)
  - Tag Name (text): Git tag name
  - Release Name (text): Release title
  - Release Body (textarea): Release description
  - Release ID (number): Release ID
- **When to use**: GitHub automation, repository management, CI/CD workflows, issue/PR management
- **Returns**: Repository data, issue/PR data, commit data, release data, or success status

### 11.2 gitlab
- **Purpose**: GitLab API integration (projects, issues, merge requests, pipelines, branches, files, CI/CD)
- **Properties**:
  - GitLab Token (required, text): GitLab personal access token (starts with `glpat-`)
  - GitLab URL (text, default: "https://gitlab.com"): GitLab instance URL
  - Operation (required, select): "get_project" (default - Get Project), "list_projects" (List Projects), "create_issue" (Create Issue), "update_issue" (Update Issue), "close_issue" (Close Issue), "list_issues" (List Issues), "get_issue" (Get Issue), "create_mr" (Create Merge Request), "update_mr" (Update Merge Request), "approve_mr" (Approve Merge Request), "merge_mr" (Merge Merge Request), "list_mrs" (List Merge Requests), "get_mr" (Get Merge Request), "trigger_pipeline" (Trigger Pipeline), "get_pipeline" (Get Pipeline), "list_pipelines" (List Pipelines), "get_pipeline_jobs" (Get Pipeline Jobs), "get_job_log" (Get Job Log), "create_branch" (Create Branch), "list_branches" (List Branches), "delete_branch" (Delete Branch), "get_file" (Get File), "create_file" (Create File), "update_file" (Update File), "delete_file" (Delete File)
  - Project ID (text): GitLab project ID or path (numeric ID or "group/project-name")
  - Title (text): Issue/MR title (required for create_issue, create_mr)
  - Description (textarea): Issue/MR description (required for create_issue, create_mr)
  - Source Branch (text): Source branch for merge request (required for create_mr)
  - Target Branch (text, default: "main"): Target branch for merge request (required for create_mr)
  - Trigger Token (text): Pipeline trigger token (for trigger_pipeline)
  - Branch/Ref (text, default: "main"): Branch name
  - Pipeline ID (text): Pipeline ID
  - Issue IID (number): Issue internal ID
  - Merge Request IID (number): Merge request internal ID
  - State Event (select): "close" (default), "reopen" (for issue/MR state)
  - Merge Commit Message (textarea): Merge commit message
  - Job ID (number): CI/CD job ID
  - Branch Name (text): Branch name
  - File Path (text): File path
  - File Content (textarea): File content
  - Commit Message (textarea): Commit message
- **When to use**: GitLab automation, project management, CI/CD pipelines, issue/MR management
- **Returns**: Project data, issue/MR data, pipeline data, or success status

### 11.3 bitbucket
- **Purpose**: Bitbucket API integration (repositories, pull requests, branches, commits, pipelines, code)
- **Properties**:
  - Username (required, text): Bitbucket username
  - App Password (required, text): Bitbucket app password (NOT account password)
  - Operation (required, select): "get_repo" (default - Get Repository), "list_repos" (List Repositories), "create_pr" (Create Pull Request), "update_pr" (Update Pull Request), "merge_pr" (Merge Pull Request), "list_prs" (List Pull Requests), "get_pr" (Get Pull Request), "add_pr_comment" (Add PR Comment), "list_pr_comments" (List PR Comments), "create_branch" (Create Branch), "list_branches" (List Branches), "get_branch" (Get Branch), "delete_branch" (Delete Branch), "list_commits" (List Commits), "get_commit" (Get Commit), "get_commit_status" (Get Commit Status), "get_pipeline" (Get Pipeline), "list_pipelines" (List Pipelines)
  - Workspace (text): Bitbucket workspace (from URL: bitbucket.org/WORKSPACE/repo-name)
  - Repository (text): Repository name
  - Pull Request ID (number): PR ID
  - Branch Name (text): Branch name
  - Title (text): PR title (required for create_pr)
  - Description (textarea): PR description (required for create_pr)
  - Source Branch (text): Source branch (required for create_pr)
  - Destination Branch (text, default: "main"): Destination branch (required for create_pr)
  - Comment (textarea): Comment text
  - Commit SHA (text): Commit hash
- **When to use**: Bitbucket automation, repository management, PR management, pipelines
- **Returns**: Repository data, PR data, commit data, pipeline data, or success status

### 11.4 jenkins
- **Purpose**: Jenkins CI/CD operations (jobs, builds, pipelines)
- **Properties**:
  - Jenkins URL (required, text): Jenkins server URL (e.g., "https://jenkins.example.com")
  - Username (required, text): Jenkins username
  - API Token (required, text): Jenkins API token
  - Operation (required, select): "get_job" (default - Get Job), "list_jobs" (List Jobs), "build_job" (Build Job), "stop_build" (Stop Build), "get_build" (Get Build), "get_build_log" (Get Build Log), "get_build_status" (Get Build Status), "poll_build_status" (Poll Build Status)
  - Job Name (text): Jenkins job name (required for get_job, build_job, etc.)
  - Build Number (number): Build number (required for get_build, get_build_log, get_build_status, stop_build)
  - Build Parameters (JSON): Build parameters (optional for build_job, e.g., {"param1": "value1"})
  - Poll Interval (seconds) (number, default: 5): Polling interval for poll_build_status
  - Max Poll Attempts (number, default: 60): Maximum polling attempts for poll_build_status
- **When to use**: Jenkins CI/CD automation, build management, job execution
- **Returns**: Job data, build data, build logs, or success status

### 11.5 docker
- **Purpose**: Docker container management (containers, images, builds, registry operations)
- **Properties**:
  - Docker Host (required, text, default: "localhost"): Docker daemon host or Unix socket (e.g., "localhost" or "unix:///var/run/docker.sock")
  - Port (number, default: 2375): Docker daemon port (2375 for TCP, 2376 for TLS)
  - Operation (required, select): "list_containers" (default - List Containers), "list_images" (List Images), "build_image" (Build Image), "tag_image" (Tag Image), "push_image" (Push Image), "pull_image" (Pull Image), "remove_image" (Remove Image), "start_container" (Start Container), "stop_container" (Stop Container), "get_container_logs" (Get Container Logs), "inspect_container" (Inspect Container)
  - Container ID/Name (text): Container ID or name (required for container operations)
  - Image Name (text): Docker image name (format: REPOSITORY:TAG, e.g., "nginx:latest")
  - Dockerfile Path (text, default: "./Dockerfile"): Path to Dockerfile (for build_image)
  - Build Context (text, default: "."): Build context path (for build_image)
  - Tag (text): Image tag (for tag_image, push_image)
  - Source Tag (text): Source image tag (for tag_image)
  - Registry (text, default: "docker.io"): Docker registry URL (for push_image)
  - Registry Username (text): Registry username (for push_image)
  - Registry Password (text): Registry password (for push_image)
- **When to use**: Docker container automation, image management, registry operations
- **Returns**: Container data, image data, logs, or success status

### 11.6 kubernetes
- **Purpose**: Kubernetes orchestration (pods, deployments, services, cluster operations)
- **Properties**:
  - API Server URL (required, text): Kubernetes API server URL (e.g., "https://your-cluster.example.com:6443")
  - Bearer Token (required, text): Kubernetes bearer token
  - Operation (required, select): "list_pods" (default - List Pods), "get_pod" (Get Pod), "list_deployments" (List Deployments), "get_deployment" (Get Deployment), "create_deployment" (Create Deployment), "update_deployment" (Update Deployment), "scale_deployment" (Scale Deployment), "restart_deployment" (Restart Deployment), "list_services" (List Services), "get_service" (Get Service), "get_pod_logs" (Get Pod Logs)
  - Namespace (text, default: "default"): Kubernetes namespace
  - Pod Name (text): Pod name (required for get_pod, get_pod_logs)
  - Deployment Name (text): Deployment name (required for deployment operations)
  - Service Name (text): Service name (required for get_service)
  - Deployment Manifest (JSON): Deployment manifest (required for create_deployment, Kubernetes deployment YAML/JSON)
  - Replicas (number): Number of replicas (required for scale_deployment)
- **When to use**: Kubernetes automation, orchestration, deployment management
- **Returns**: Pod data, deployment data, service data, logs, or success status

### 11.7 pagerduty
- **Purpose**: PagerDuty incident management (incidents, on-calls, schedules, alerting)
- **Properties**:
  - API Key (required, text): PagerDuty API key
  - Operation (required, select): "list_incidents" (default - List Incidents), "get_incident" (Get Incident), "create_incident" (Create Incident), "update_incident" (Update Incident), "acknowledge_incident" (Acknowledge Incident), "resolve_incident" (Resolve Incident), "list_on_calls" (List On-Calls), "get_on_call" (Get On-Call), "list_schedules" (List Schedules), "get_schedule" (Get Schedule)
  - Incident ID (text): Incident ID (required for get_incident, update_incident, acknowledge_incident, resolve_incident, format: "P123456")
  - Title (text): Incident title (required for create_incident)
  - Service ID (text): Service ID (required for create_incident)
  - Urgency (select): "Low", "High" (incident urgency)
  - Priority ID (text): Priority ID
  - On-Call ID (text): On-call ID
  - Schedule ID (text): Schedule ID (required for get_schedule)
- **When to use**: Incident response, on-call management, alerting
- **Returns**: Incident data, on-call data, schedule data, or success status

### 11.8 datadog
- **Purpose**: Datadog monitoring & metrics (query metrics, send custom metrics, post events, manage monitors)
- **Properties**:
  - API Key (required, text): Datadog API key
  - Application Key (required, text): Datadog application key (different from API Key - need BOTH)
  - Datadog Site (select): "datadoghq.com" (default - US), "datadoghq.eu" (EU), "us3.datadoghq.com" (US3), "us5.datadoghq.com" (US5)
  - Operation (required, select): "query_metrics" (default - Query Metrics), "send_metric" (Send Custom Metric), "post_event" (Post Event), "list_monitors" (List Monitors), "get_monitor" (Get Monitor), "create_monitor" (Create Monitor), "update_monitor" (Update Monitor), "delete_monitor" (Delete Monitor), "mute_monitor" (Mute Monitor), "unmute_monitor" (Unmute Monitor)
  - Query (text): Metrics query (required for query_metrics, Datadog query syntax)
  - Metric Name (text): Metric name (required for send_metric)
  - Metric Value (number): Metric value (required for send_metric)
  - Tags (JSON): Metric tags (e.g., ["env:production", "service:api"])
  - Title (text): Event/monitor title (required for post_event, create_monitor)
  - Text (textarea): Event text (required for post_event)
  - Monitor ID (text): Monitor ID (required for get_monitor, update_monitor, delete_monitor, mute_monitor, unmute_monitor)
  - Monitor Query (text): Monitor query (required for create_monitor)
  - Monitor Type (select): Monitor type (Metric Alert, Service Check, Event Alert, Log Alert, Process Alert, APM Alert, Composite, Watchdog)
- **When to use**: Infrastructure monitoring, observability, metrics tracking, event management
- **Returns**: Metrics data, event data, monitor data, or success status

## 12. E-COMMERCE NODES (5 nodes)
**Purpose**: E-commerce platform and payment processing integrations

**Note**: All e-commerce nodes require API keys or authentication credentials from their respective providers. Payment nodes (Stripe, PayPal) handle payment processing, while e-commerce platform nodes (Shopify, WooCommerce, BigCommerce) manage store operations.

### 12.1 shopify
- **Purpose**: Shopify e-commerce operations (products, orders, customers, inventory)
- **Properties**:
  - Operation (required, select): "get_product" (default - Get Product), "list_products" (List Products), "create_product" (Create Product), "update_product" (Update Product), "get_order" (Get Order), "list_orders" (List Orders), "create_order" (Create Order), "get_customer" (Get Customer), "list_customers" (List Customers)
  - Shop Domain (required, text): Shopify store domain (e.g., "your-shop.myshopify.com", do NOT include "https://" or "www")
  - Access Token (required, text): Shopify Admin API access token (starts with `shpat_`)
  - Product ID (text): Shopify product ID (required for get_product, update_product)
  - Order ID (text): Shopify order ID (required for get_order)
  - Customer ID (text): Shopify customer ID (required for get_customer)
  - Data (JSON): Product/Order/Customer data (required for create/update, e.g., {"title": "Product Name", "price": "29.99"})
  - Limit (number, default: 250): Maximum number of results to return
- **When to use**: Shopify store management, product/order/customer management
- **Returns**: Product data, order data, customer data, or success status

### 12.2 woocommerce
- **Purpose**: WooCommerce store operations (WordPress-based e-commerce)
- **Properties**:
  - Operation (required, select): "get_product" (default - Get Product), "list_products" (List Products), "create_product" (Create Product), "update_product" (Update Product), "get_order" (Get Order), "list_orders" (List Orders), "create_order" (Create Order), "get_customer" (Get Customer)
  - Store URL (required, text): WooCommerce store URL (without trailing slash, e.g., "https://yourstore.com")
  - Consumer Key (required, text): WooCommerce consumer key (starts with `ck_`)
  - Consumer Secret (required, text): WooCommerce consumer secret (starts with `cs_`)
  - Product ID (text): Product ID (required for get_product, update_product)
  - Order ID (text): Order ID (required for get_order)
  - Customer ID (text): Customer ID (required for get_customer)
  - Data (JSON): Product/Order/Customer data (required for create/update, e.g., {"name": "Product Name", "regular_price": "29.99"})
  - Per Page (number, default: 10): Number of results per page
- **When to use**: WooCommerce store management, WordPress e-commerce automation
- **Returns**: Product data, order data, customer data, or success status

### 12.3 stripe ⭐
- **Purpose**: Stripe payment processing (payments, customers, subscriptions, invoices, refunds)
- **Properties**:
  - Operation (required, select): "create_payment" (default - Create Payment), "create_payment_intent" (Create Payment Intent), "get_payment" (Get Payment), "list_payments" (List Payments), "create_refund" (Create Refund), "create_customer" (Create Customer), "create_subscription" (Create Subscription), "create_invoice" (Create Invoice)
  - API Key (required, text): Stripe API key (starts with `sk_test_` for test, `sk_live_` for live)
  - Amount (cents) (number): Payment amount in smallest currency unit (for payment operations, e.g., 1000 = $10.00 for USD)
  - Currency (text, default: "usd"): ISO currency code (3 letters, e.g., "usd", "eur", "gbp", "inr", "jpy")
  - Payment Method ID (text): Stripe payment method ID (starts with `pm_`, for payment operations)
  - Customer ID (text): Stripe customer ID (starts with `cus_`, for customer-related operations)
  - Payment Intent ID (text): Payment Intent ID (starts with `pi_`, for get operations)
  - Metadata (JSON): Additional metadata (e.g., {"order_id": "12345"})
- **When to use**: Payment processing, customer management, subscriptions, invoices, refunds
- **⚠️ IMPORTANT**: Amount is in smallest currency unit (cents for USD/EUR, etc.). For $10.00, use 1000.
- **Returns**: Payment data, customer data, subscription data, invoice data, or success status

### 12.4 paypal
- **Purpose**: PayPal payment processing (orders, payments, refunds, transactions)
- **Properties**:
  - Operation (required, select): "create_order" (default - Create Order), "get_order" (Get Order), "capture_order" (Capture Order), "create_refund" (Create Refund), "get_access_token" (Get Access Token)
  - Client ID (required, text): PayPal client ID
  - Client Secret (required, text): PayPal client secret
  - Environment (required, select): "sandbox" (default - Sandbox), "production" (Production)
  - Amount (text): Order amount as decimal string (e.g., "10.00" for $10.00)
  - Currency (text, default: "USD"): ISO currency code (3 letters, e.g., "USD", "EUR", "GBP")
  - Order ID (text): PayPal order ID (required for get_order, capture_order)
- **When to use**: PayPal payment processing, order management, refunds
- **⚠️ IMPORTANT**: Amount is decimal string (not cents). For $10.00, use "10.00" (not 1000).
- **Returns**: Order data, payment data, or success status

### 12.5 bigcommerce
- **Purpose**: BigCommerce store operations (products, orders, customers, store data)
- **Properties**:
  - Operation (required, select): "get_product" (default - Get Product), "list_products" (List Products), "create_product" (Create Product), "update_product" (Update Product), "get_order" (Get Order), "list_orders" (List Orders), "get_customer" (Get Customer)
  - Store Hash (required, text): BigCommerce store hash (from API credentials)
  - Access Token (required, text): BigCommerce API access token
  - Product ID (text): Product ID (required for get_product, update_product)
  - Order ID (text): Order ID (required for get_order)
  - Customer ID (text): Customer ID (required for get_customer)
  - Data (JSON): Product/Order/Customer data (required for create/update, e.g., {"name": "Product Name", "price": "29.99"})
  - Limit (number, default: 250): Maximum number of results to return
- **When to use**: BigCommerce store management, product/order/customer management
- **Returns**: Product data, order data, customer data, or success status

## 13. ANALYTICS NODES (4 nodes)
**Purpose**: Data analytics and event tracking integrations

**Note**: All analytics nodes require API keys, tokens, or authentication credentials from their respective providers. Used for tracking user events, analyzing behavior, and querying analytics data.

### 13.1 google_analytics
- **Purpose**: Google Analytics (GA4) data and reporting (retrieve reports, list properties, track events)
- **Properties**:
  - Operation (required, select): "get_report" (default - Get Report), "list_properties" (List Properties), "track_event" (Track Event)
  - Access Token (required, text): Google Analytics access token (OAuth2 access token or Service Account token)
  - Property ID (text): Google Analytics property ID (format: "properties/123456789", required for get_report)
  - Date Ranges (JSON): Date range array (required for get_report, e.g., [{"startDate": "2024-01-01", "endDate": "2024-01-31"}])
  - Dimensions (JSON): Dimension array (required for get_report, e.g., ["date", "country", "city"])
  - Metrics (JSON): Metric array (required for get_report, e.g., ["activeUsers", "sessions", "screenPageViews"])
  - Event Name (text): Event name (required for track_event, e.g., "purchase")
  - Event Parameters (JSON): Event parameters (required for track_event, e.g., {"value": 29.99, "currency": "USD"})
- **When to use**: Web and app analytics automation, event tracking, report generation
- **Returns**: Report data, properties array, or success status

### 13.2 mixpanel
- **Purpose**: Mixpanel analytics and event tracking (track events, identify users, query insights)
- **Properties**:
  - Operation (required, select): "track_event" (default - Track Event), "track_user" (Track User), "get_event" (Get Event), "query_insights" (Query Insights)
  - Project Token (required, text): Mixpanel project token
  - API Secret (required, text): Mixpanel API secret (required for query operations)
  - Event Name (text): Event name (required for track_event, e.g., "Button Click")
  - Distinct ID (text): User identifier (required for tracking, user ID or distinct ID)
  - Properties (JSON): Event or user properties (e.g., {"button": "signup", "page": "home"})
  - Query (JSON): Insights query (required for query_insights, e.g., {"event": "Purchase", "from_date": "2024-01-01", "to_date": "2024-01-31"})
- **When to use**: Product analytics, user behavior tracking, insights querying
- **Returns**: Success status or insights data

### 13.3 segment
- **Purpose**: Segment analytics and data routing (track events, identify users, track page views, group users)
- **Properties**:
  - Operation (required, select): "track" (default - Track), "identify" (Identify), "page" (Page), "group" (Group)
  - Write Key (required, text): Segment write key
  - User ID (text): User identifier (required for identify, track, page operations)
  - Event Name (text): Event name (required for track operation, e.g., "Button Clicked")
  - Properties (JSON): Event properties (for track operation, e.g., {"button": "signup", "page": "home"})
  - Traits (JSON): User traits (for identify operation, e.g., {"email": "user@example.com", "name": "John Doe"})
  - Page Name (text): Page name (required for page operation, e.g., "Home")
  - Group ID (text): Group identifier (required for group operation)
- **When to use**: Customer data platform, event routing, user identification, page tracking, user grouping
- **Returns**: Success status

### 13.4 amplitude
- **Purpose**: Amplitude analytics and product analytics (track events, identify users, retrieve event data)
- **Properties**:
  - Operation (required, select): "track" (default - Track Event), "identify" (Identify User), "get_event" (Get Event)
  - API Key (required, text): Amplitude API key
  - Secret Key (required, text): Amplitude secret key (required for get_event operation)
  - User ID (text): User identifier (required for track and identify operations)
  - Event Type (text): Event type/name (required for track operation, e.g., "Button Clicked")
  - Event Properties (JSON): Event properties (for track operation, e.g., {"button": "signup", "page": "home"})
  - User Properties (JSON): User properties (for identify operation, e.g., {"email": "user@example.com", "name": "John Doe"})
- **When to use**: Product analytics, user behavior analysis, event tracking, user identification
- **Returns**: Success status or event data

---

## SUMMARY

**Total Nodes**: 89+ nodes across 17 categories

**Most Common Categories**:
1. **Triggers** (8 nodes) - Start workflows
2. **Logic** (10 nodes) - Control flow
3. **Data** (16+ nodes) - Transform data
4. **Database** (11 nodes) - Database operations (⭐ Use database_read/write for Supabase)
5. **HTTP & API** (3 nodes) - API calls (⭐ http_request most common)
6. **Communication** (9 nodes) - Send messages
7. **AI & ML** (15 nodes) - AI processing
8. **Google** (8 nodes) - Google services (require OAuth)
9. **Storage** (10 nodes) - File operations
10. **CRM** (8 nodes) - CRM platforms
11. **DevOps** (8 nodes) - Development tools
12. **E-commerce** (5 nodes) - E-commerce platforms
13. **Analytics** (4 nodes) - Analytics platforms

**Key Patterns**:
- Most nodes require API keys or OAuth tokens
- Template variables use `{{input.field}}` syntax
- Webhook data: `{{input.body.field}}`, Form data: `{{input.data.field}}`
- Database nodes for Supabase: prefer `database_read`, `database_write`, `supabase`
- HTTP Request returns data directly (not in `input.body`)

For detailed information about each node's properties and usage, please ensure NODE_REFERENCE_FOR_AGENT.md is available.
