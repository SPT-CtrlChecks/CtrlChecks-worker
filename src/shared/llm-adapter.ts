// LLM Adapter Layer for CtrlChecks AI
// Unified interface for all LLM providers (OpenAI, Claude, Gemini, Ollama)

import { Ollama } from 'ollama';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  stream?: boolean;
  provider?: 'openai' | 'claude' | 'gemini' | 'ollama';
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model?: string;
}

export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'ollama';

/**
 * Unified LLM Adapter
 * Provides consistent interface across all LLM providers
 */
export class LLMAdapter {
  private ollama: Ollama | null = null;

  constructor() {
    // Initialize Ollama client if OLLAMA_HOST is set
    const ollamaHost = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    try {
      this.ollama = new Ollama({ host: ollamaHost });
    } catch (error) {
      console.warn('Ollama client initialization failed:', error);
    }
  }

  /**
   * Chat completion using any provider
   */
  async chat(
    provider: LLMProvider,
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    switch (provider) {
      case 'openai':
        return this.chatOpenAI(messages, options);
      case 'claude':
        return this.chatClaude(messages, options);
      case 'gemini':
        return this.chatGemini(messages, options);
      case 'ollama':
        return this.chatOllama(messages, options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Generate embeddings
   */
  async embed(
    provider: 'openai' | 'gemini' | 'ollama',
    text: string,
    apiKey?: string
  ): Promise<EmbeddingResponse> {
    switch (provider) {
      case 'openai':
        return this.embedOpenAI(text, apiKey);
      case 'gemini':
        return this.embedGemini(text, apiKey);
      case 'ollama':
        return this.embedOllama(text);
      default:
        throw new Error(`Embedding not supported for provider: ${provider}`);
    }
  }

  /**
   * Ollama Chat Completion
   */
  private async chatOllama(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    if (!this.ollama) {
      throw new Error('Ollama client not initialized. Set OLLAMA_HOST environment variable.');
    }

    const model = options.model || 'llama3.1:8b';
    
    try {
      // Convert messages to Ollama format
      const ollamaMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Handle streaming vs non-streaming
      if (options.stream === true) {
        // For streaming, collect all chunks
        const stream = await this.ollama.chat({
          model,
          messages: ollamaMessages,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens,
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
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        };
      } else {
        // Non-streaming request
        const response = await this.ollama.chat({
          model,
          messages: ollamaMessages,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens,
          },
        });

        return {
          content: response.message.content,
          model: response.model,
          usage: {
            promptTokens: response.prompt_eval_count || 0,
            completionTokens: response.eval_count || 0,
            totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
          },
          finishReason: response.done ? 'stop' : undefined,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw new Error(`Ollama API request failed: ${String(error)}`);
    }
  }

  /**
   * Ollama Embeddings
   */
  private async embedOllama(text: string): Promise<EmbeddingResponse> {
    if (!this.ollama) {
      throw new Error('Ollama client not initialized. Set OLLAMA_HOST environment variable.');
    }

    try {
      const response = await this.ollama.embeddings({
        model: 'llama3.1:8b', // Default embedding model
        prompt: text,
      });

      return {
        embedding: response.embedding,
        model: 'llama3.1:8b',  // Production model for embeddings
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama embeddings error: ${error.message}`);
      }
      throw new Error(`Ollama embeddings request failed: ${String(error)}`);
    }
  }

  /**
   * OpenAI Chat Completion
   */
  private async chatOpenAI(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Prioritize user-provided config over environment variables
      if (!options.apiKey) {
        throw new Error('OpenAI API key required. Please provide your API key in the node properties (API Key field).');
      }
      throw new Error('OpenAI API key required. Provide apiKey in options or set OPENAI_API_KEY environment variable.');
    }

    // Map model names to OpenAI format
    const modelMap: Record<string, string> = {
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-4': 'gpt-4',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
    };

    const model = modelMap[options.model] || options.model || 'gpt-4o';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: options.stream || false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenAI API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += ` - ${errorJson.error?.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`OpenAI API: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error(`OpenAI API: Invalid response format. Expected choices array.`);
      }
      
      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        model: data.model,
        finishReason: data.choices[0]?.finish_reason,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`OpenAI API request failed: ${String(error)}`);
    }
  }

  /**
   * Anthropic Claude Chat Completion
   */
  private async chatClaude(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Prioritize user-provided config over environment variables
      if (!options.apiKey) {
        throw new Error('Anthropic API key required. Please provide your API key in the node properties (API Key field).');
      }
      throw new Error('Anthropic API key required. Provide apiKey in options or set ANTHROPIC_API_KEY environment variable.');
    }

    // Map model names to Claude format
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
    };

    const model = modelMap[options.model] || options.model || 'claude-3-5-sonnet-20241022';

    // Convert messages to Claude format
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          system: systemMessage?.content,
          messages: conversationMessages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Claude API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += ` - ${errorJson.error?.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Claude API: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!data || !data.content || !Array.isArray(data.content)) {
        throw new Error(`Claude API: Invalid response format. Expected content array.`);
      }
      
      const content = data.content
        .map((block: any) => block?.text || '')
        .filter((text: string) => text)
        .join('');

      return {
        content,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
        model: data.model,
        finishReason: data.stop_reason,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Claude API request failed: ${String(error)}`);
    }
  }

  /**
   * Google Gemini Chat Completion
   */
  private async chatGemini(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Prioritize user-provided config over environment variables
      if (!options.apiKey) {
        throw new Error('Gemini API key required. Please provide your API key in the node properties (API Key field).');
      }
      throw new Error('Gemini API key required. Provide apiKey in options or set GEMINI_API_KEY environment variable.');
    }

    // Map model names to Gemini format
    const modelMap: Record<string, string> = {
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-pro': 'gemini-pro',
    };

    const model = modelMap[options.model] || options.model || 'gemini-1.5-flash';

    // Convert messages to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const conversationParts = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: conversationParts,
          systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }],
          } : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += ` - ${errorJson.error?.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Gemini API: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        throw new Error(`Gemini API: Invalid response format. Expected candidates array.`);
      }
      
      const content = data.candidates[0]?.content?.parts?.[0]?.text || '';
      const usageInfo = data.usageMetadata;

      return {
        content,
        usage: usageInfo ? {
          promptTokens: usageInfo.promptTokenCount || 0,
          completionTokens: usageInfo.candidatesTokenCount || 0,
          totalTokens: usageInfo.totalTokenCount || 0,
        } : undefined,
        model: data.model || model,
        finishReason: data.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Gemini API request failed: ${String(error)}`);
    }
  }

  /**
   * OpenAI Embeddings
   */
  private async embedOpenAI(
    text: string,
    apiKey?: string
  ): Promise<EmbeddingResponse> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key required for embeddings');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embeddings API error: ${response.status} - ${errorText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`OpenAI Embeddings API: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error(`OpenAI Embeddings API: Invalid response format. Expected data array with embeddings.`);
      }
      
      if (!data.data[0] || !data.data[0].embedding || !Array.isArray(data.data[0].embedding)) {
        throw new Error(`OpenAI Embeddings API: Invalid embedding format.`);
      }
      
      return {
        embedding: data.data[0].embedding,
        model: data.model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`OpenAI Embeddings request failed: ${String(error)}`);
    }
  }

  /**
   * Gemini Embeddings (if supported)
   */
  private async embedGemini(
    text: string,
    apiKey?: string
  ): Promise<EmbeddingResponse> {
    throw new Error('Gemini embeddings not yet implemented. Use OpenAI or Ollama for embeddings.');
  }

  /**
   * Detect provider from model name
   */
  static detectProvider(model: string): LLMProvider {
    if (model.startsWith('gpt-') || model.includes('openai')) {
      return 'openai';
    }
    // Check for Ollama production models first
    if (model.includes('llama3.1') || model.includes('qwen2.5-coder') || model.includes('ollama')) {
      return 'ollama';
    }
    if (model.startsWith('claude-') || model.includes('anthropic')) {
      return 'claude';
    }
    if (model.startsWith('gemini-') || model.includes('gemini')) {
      return 'gemini';
    }
    if (model.includes('llama') || model.includes('ollama') || model.includes('qwen2.5-coder')) {
      return 'ollama';
    }
    // Default to Ollama for production (instead of OpenAI)
    return 'ollama';
  }

  /**
   * Get available models for a provider
   */
  static getAvailableModels(provider: LLMProvider): string[] {
    switch (provider) {
      case 'openai':
        return [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
        ];
      case 'claude':
        return [
          'claude-3-5-sonnet',
          'claude-3-5-haiku',
          'claude-3-opus',
          'claude-3-sonnet',
          'claude-3-haiku',
        ];
      case 'gemini':
        return [
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-2.5-flash-lite',
          'gemini-pro',
          'gemini-1.5-pro',
        ];
      case 'ollama':
        return [
          'llama3.1:8b',
          'qwen2.5-coder:7b',
        ];
      default:
        return [];
    }
  }
}
