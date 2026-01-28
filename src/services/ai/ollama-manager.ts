// Ollama Manager - Central AI Service
// Routes ALL AI requests through Ollama models
// Supports local and AWS Ollama instances

import { Ollama } from 'ollama';
import { config } from '../../core/config';

export interface OllamaModel {
  name: string;
  size: string;
  capabilities: string[];
  loaded: boolean;
}

export interface OllamaGenerationOptions {
  model?: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  images?: string[];
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

/**
 * Model Capabilities Mapping
 * Based on your available models, optimized for AWS deployment
 */
const MODEL_CAPABILITIES = {
  // PRIMARY MODELS (Best 3 for production)
  'qwen2.5:3b': {
    size: '1.9GB',
    capabilities: ['text-generation', 'chat', 'multilingual', 'reasoning', 'fast'],
    priority: 1, // Primary - fastest, good quality
    useCase: 'General purpose, chat, fast responses'
  },
  'codellama:7b': {
    size: '3.8GB',
    capabilities: ['code-generation', 'code-analysis', 'debugging', 'documentation'],
    priority: 1, // Primary - best for code
    useCase: 'Code generation, analysis, debugging'
  },
  'llava:latest': {
    size: '4.7GB',
    capabilities: ['image-analysis', 'vision', 'image-description'],
    priority: 1, // Primary - only vision model
    useCase: 'Image understanding tasks'
  },
  
  // FALLBACK MODELS
  'mistral:7b': {
    size: '4.4GB',
    capabilities: ['text-generation', 'summarization', 'chat'],
    priority: 2,
    useCase: 'Fallback for text generation'
  },
  'llama3.1:8b': {
    size: '4.9GB',
    capabilities: ['text-generation', 'reasoning', 'chat'],
    priority: 2,
    useCase: 'Fallback for complex reasoning'
  },
  'qwen2.5:7b': {
    size: '4.7GB',
    capabilities: ['text-generation', 'multilingual', 'chat'],
    priority: 2,
    useCase: 'Fallback for multilingual tasks'
  }
};

/**
 * Ollama Manager - Central AI Service
 * Manages all Ollama model interactions
 */
export class OllamaManager {
  private ollama: Ollama;
  private endpoint: string;
  private loadedModels: Set<string> = new Set();
  private modelCache: Map<string, any> = new Map();
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || config.ollamaHost || 'http://localhost:11434';
    this.ollama = new Ollama({ host: this.endpoint });
  }

  /**
   * Initialize - Check connection and load primary models
   */
  async initialize(): Promise<void> {
    try {
      // Check Ollama connection
      const models = await this.ollama.list();
      this.loadedModels = new Set(models.models.map((m: any) => m.name));
      
      console.log(`✅ Ollama connected at ${this.endpoint}`);
      console.log(`📦 Loaded models: ${Array.from(this.loadedModels).join(', ')}`);
      
      // Ensure primary models are loaded
      await this.ensureModelsLoaded(['qwen2.5:3b', 'codellama:7b', 'llava:latest']);
    } catch (error) {
      console.error('❌ Failed to connect to Ollama:', error);
      throw new Error(`Ollama connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure models are loaded (pull if needed)
   */
  async ensureModelsLoaded(modelNames: string[]): Promise<void> {
    for (const modelName of modelNames) {
      if (!this.loadedModels.has(modelName)) {
        console.log(`📥 Pulling model: ${modelName}...`);
        try {
          await this.pullModel(modelName);
          this.loadedModels.add(modelName);
          console.log(`✅ Model loaded: ${modelName}`);
        } catch (error) {
          console.warn(`⚠️  Failed to load model ${modelName}:`, error);
        }
      }
    }
  }

  /**
   * Pull a model from Ollama
   */
  private async pullModel(modelName: string): Promise<void> {
    const stream = await this.ollama.pull({ model: modelName, stream: true });
    
    for await (const chunk of stream) {
      if (chunk.digest) {
        process.stdout.write(`\r📥 Downloading ${modelName}: ${chunk.completed || 0}/${chunk.total || 0}`);
      }
    }
    process.stdout.write('\n');
  }

  /**
   * Select best model for a given task
   */
  selectBestModel(task: string, options?: { requireVision?: boolean; requireCode?: boolean }): string {
    if (options?.requireVision) {
      return 'llava:latest';
    }
    
    if (options?.requireCode || task.toLowerCase().includes('code') || task.toLowerCase().includes('programming')) {
      return 'codellama:7b';
    }
    
    // Default to fastest general-purpose model
    return 'qwen2.5:3b';
  }

  /**
   * Generate text using Ollama
   */
  async generate(
    prompt: string,
    options: OllamaGenerationOptions = {}
  ): Promise<{
    content: string;
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const model = options.model || this.selectBestModel(prompt);
    
    // Ensure model is loaded
    if (!this.loadedModels.has(model)) {
      await this.ensureModelsLoaded([model]);
    }

    try {
      if (options.stream) {
        // Handle streaming
        const stream = await this.ollama.generate({
          model,
          prompt,
          system: options.system,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens,
          },
          stream: true,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk.response || '';
        }

        return {
          content: fullContent,
          model,
        };
      } else {
        // Non-streaming
        const response = await this.ollama.generate({
          model,
          prompt,
          system: options.system,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens,
          },
          stream: false,
        });

        return {
          content: response.response,
          model: response.model,
          usage: {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
          },
        };
      }
    } catch (error) {
      console.error(`Error generating with model ${model}:`, error);
      
      // Try fallback model
      if (model !== 'qwen2.5:3b') {
        console.log(`🔄 Trying fallback model: qwen2.5:3b`);
        return this.generate(prompt, { ...options, model: 'qwen2.5:3b' });
      }
      
      throw error;
    }
  }

  /**
   * Chat completion using Ollama
   */
  async chat(
    messages: OllamaChatMessage[],
    options: { model?: string; temperature?: number; stream?: boolean } = {}
  ): Promise<{
    content: string;
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const model = options.model || this.selectBestModel(messages[messages.length - 1]?.content || '');
    
    // Ensure model is loaded
    if (!this.loadedModels.has(model)) {
      await this.ensureModelsLoaded([model]);
    }

    try {
      // Convert messages to Ollama format
      const ollamaMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        images: msg.images,
      }));

      if (options.stream) {
        const stream = await this.ollama.chat({
          model,
          messages: ollamaMessages,
          options: {
            temperature: options.temperature ?? 0.7,
          },
          stream: true,
        });

        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk.message?.content || '';
        }

        return {
          content: fullContent,
          model,
        };
      } else {
        const response = await this.ollama.chat({
          model,
          messages: ollamaMessages,
          options: {
            temperature: options.temperature ?? 0.7,
          },
          stream: false,
        });

        return {
          content: response.message.content,
          model: response.model,
          usage: {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
          },
        };
      }
    } catch (error) {
      console.error(`Error in chat with model ${model}:`, error);
      
      // Try fallback
      if (model !== 'qwen2.5:3b') {
        return this.chat(messages, { ...options, model: 'qwen2.5:3b' });
      }
      
      throw error;
    }
  }


  /**
   * Generate embeddings
   */
  async embeddings(
    text: string,
    model: string = 'nomic-embed-text'
  ): Promise<number[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embeddings API error: ${response.statusText}`);
      }

      const data = await response.json() as { embedding?: number[] };
      return data.embedding || [];
    } catch (error) {
      console.error(`Error generating embeddings:`, error);
      throw error;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const models = await this.ollama.list();
      return models.models.map((m: any) => ({
        name: m.name,
        size: `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
        capabilities: MODEL_CAPABILITIES[m.name as keyof typeof MODEL_CAPABILITIES]?.capabilities || [],
        loaded: true,
      }));
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; models: string[]; endpoint: string }> {
    try {
      const models = await this.ollama.list();
      return {
        healthy: true,
        models: models.models.map((m: any) => m.name),
        endpoint: this.endpoint,
      };
    } catch (error) {
      return {
        healthy: false,
        models: [],
        endpoint: this.endpoint,
      };
    }
  }
}

// Export singleton instance
export const ollamaManager = new OllamaManager();
