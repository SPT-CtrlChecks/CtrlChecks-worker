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
  __fallbackAttempt?: number; // Internal: track fallback attempts
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
   * Wrapper for fetch with extended timeout
   */
  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 600000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
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

    // Extended timeout for large model responses (10 minutes)
    // Increased from 5min to handle slow models and complex prompts
    const TIMEOUT_MS = 600000;
    
    try {
      if (options.stream) {
        // Handle streaming with timeout
        const generatePromise = this.ollama.generate({
          model,
          prompt,
          system: options.system,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens,
          },
          stream: true,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Stream generation timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
        });

        const stream = await Promise.race([generatePromise, timeoutPromise]);

        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk.response || '';
        }

        return {
          content: fullContent,
          model,
        };
      } else {
        // Non-streaming with timeout
        const generatePromise = this.ollama.generate({
          model,
          prompt,
          system: options.system,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens,
          },
          stream: false,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Generation timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);

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
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout') || errorMessage.includes('UND_ERR');
      
      console.error(`Error generating with model ${model}:`, error);
      
      if (isTimeout) {
        console.warn(`⏱️  Timeout error with model ${model}. This may indicate the model is slow or Ollama service is overloaded.`);
      }
      
      // Try fallback models in order: mistral:7b -> qwen2.5:7b
      // Don't fallback to the same model that failed
      const fallbackChain: Record<string, string[]> = {
        'qwen2.5:3b': ['mistral:7b', 'qwen2.5:7b'],
        'mistral:7b': ['qwen2.5:7b'],
        'qwen2.5:7b': ['mistral:7b'],
        'codellama:7b': ['mistral:7b', 'qwen2.5:7b'],
      };
      
      const fallbacks = fallbackChain[model] || ['mistral:7b', 'qwen2.5:7b'];
      
      if (fallbacks.length > 0) {
        const fallbackModel = fallbacks[0];
        console.log(`🔄 Trying fallback model: ${fallbackModel} (was using ${model})`);
        
        // Reduce max_tokens on retry to prevent timeout (reduce by 30%)
        const reducedMaxTokens = options.max_tokens 
          ? Math.floor(options.max_tokens * 0.7)
          : undefined;
        
        // Prevent infinite recursion by tracking attempts
        const attemptCount = (options as any).__fallbackAttempt || 0;
        if (attemptCount >= 2) {
          throw new Error(`All fallback models exhausted. Original error: ${errorMessage}`);
        }
        
        return this.generate(prompt, { 
          ...options, 
          model: fallbackModel,
          max_tokens: reducedMaxTokens,
          __fallbackAttempt: attemptCount + 1
        });
      }
      
      // If all fallbacks exhausted or model is already a fallback, throw error
      throw error;
    }
  }

  /**
   * Chat completion using Ollama
   */
  async chat(
    messages: OllamaChatMessage[],
    options: { model?: string; temperature?: number; stream?: boolean; __fallbackAttempt?: number } = {}
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
      
      // Try fallback models
      const fallbackChain: Record<string, string[]> = {
        'qwen2.5:3b': ['mistral:7b', 'qwen2.5:7b'],
        'mistral:7b': ['qwen2.5:7b'],
        'qwen2.5:7b': ['mistral:7b'],
        'codellama:7b': ['mistral:7b', 'qwen2.5:7b'],
      };
      
      const fallbacks = fallbackChain[model] || ['mistral:7b', 'qwen2.5:7b'];
      
      if (fallbacks.length > 0) {
        const fallbackModel = fallbacks[0];
        const attemptCount = (options as any).__fallbackAttempt || 0;
        if (attemptCount >= 2) {
          throw error;
        }
        
        console.log(`🔄 Trying fallback model for chat: ${fallbackModel}`);
        return this.chat(messages, { 
          ...options, 
          model: fallbackModel,
          __fallbackAttempt: attemptCount + 1
        });
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
