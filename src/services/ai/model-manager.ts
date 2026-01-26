// Model Manager - Handles model loading, unloading, and optimization

import { OllamaManager } from './ollama-manager';
import { ollamaManager } from './ollama-manager';

export interface ModelInfo {
  name: string;
  size: string;
  capabilities: string[];
  loaded: boolean;
  lastUsed?: Date;
  usageCount: number;
}

/**
 * Model Manager
 * Manages model lifecycle, loading, and optimization
 */
export class ModelManager {
  private ollama: OllamaManager;
  private modelStats: Map<string, ModelInfo> = new Map();
  private maxLoadedModels = 5; // Keep max 5 models loaded at once
  private modelUsage: Map<string, number> = new Map();

  constructor(ollamaManager: OllamaManager) {
    this.ollama = ollamaManager;
  }

  /**
   * Get model information
   */
  getModelInfo(modelName: string): ModelInfo | null {
    return this.modelStats.get(modelName) || null;
  }

  /**
   * Track model usage
   */
  trackUsage(modelName: string): void {
    const current = this.modelUsage.get(modelName) || 0;
    this.modelUsage.set(modelName, current + 1);

    const info = this.modelStats.get(modelName);
    if (info) {
      info.lastUsed = new Date();
      info.usageCount++;
    }
  }

  /**
   * Get recommended models for AWS deployment
   * Based on your available models and AWS instance constraints
   */
  getRecommendedModels(): string[] {
    // Best 3 models for production (fits in most AWS GPU instances)
    return [
      'qwen2.5:3b',      // 1.9GB - Fast, general purpose
      'codellama:7b',    // 3.8GB - Code generation
      'llava:latest',   // 4.7GB - Multimodal/vision
    ];
    // Total: ~10.4GB - Fits in g4dn.xlarge (16GB GPU) or larger
  }

  /**
   * Get fallback models
   */
  getFallbackModels(primaryModel: string): string[] {
    const fallbackMap: Record<string, string[]> = {
      'qwen2.5:3b': ['mistral:7b', 'llama3.1:8b'],
      'codellama:7b': ['qwen2.5:3b', 'mistral:7b'],
      'llava:latest': ['qwen2.5:3b'], // No vision fallback, use text description
      'mistral:7b': ['qwen2.5:3b', 'llama3.1:8b'],
      'llama3.1:8b': ['qwen2.5:3b', 'mistral:7b'],
    };

    return fallbackMap[primaryModel] || ['qwen2.5:3b'];
  }

  /**
   * Initialize - Load recommended models
   */
  async initialize(): Promise<void> {
    const recommended = this.getRecommendedModels();
    console.log('📦 Loading recommended models:', recommended.join(', '));
    
    await this.ollama.ensureModelsLoaded(recommended);
    
    // Initialize stats
    for (const model of recommended) {
      this.modelStats.set(model, {
        name: model,
        size: this.getModelSize(model),
        capabilities: this.getModelCapabilities(model),
        loaded: true,
        usageCount: 0,
      });
    }
  }

  /**
   * Get model size
   */
  private getModelSize(modelName: string): string {
    const sizes: Record<string, string> = {
      'qwen2.5:3b': '1.9GB',
      'codellama:7b': '3.8GB',
      'llava:latest': '4.7GB',
      'mistral:7b': '4.4GB',
      'llama3.1:8b': '4.9GB',
      'qwen2.5:7b': '4.7GB',
    };
    return sizes[modelName] || 'Unknown';
  }

  /**
   * Get model capabilities
   */
  private getModelCapabilities(modelName: string): string[] {
    const capabilities: Record<string, string[]> = {
      'qwen2.5:3b': ['text-generation', 'chat', 'multilingual', 'reasoning'],
      'codellama:7b': ['code-generation', 'code-analysis', 'debugging'],
      'llava:latest': ['image-analysis', 'multimodal', 'vision'],
      'mistral:7b': ['text-generation', 'summarization', 'chat'],
      'llama3.1:8b': ['text-generation', 'reasoning', 'chat'],
      'qwen2.5:7b': ['text-generation', 'multilingual', 'chat'],
    };
    return capabilities[modelName] || [];
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [model, count] of this.modelUsage.entries()) {
      const info = this.modelStats.get(model);
      stats[model] = {
        usageCount: count,
        lastUsed: info?.lastUsed,
        capabilities: info?.capabilities || [],
        size: info?.size || 'Unknown',
      };
    }
    
    return stats;
  }
}

// Export singleton
export const modelManager = new ModelManager(ollamaManager);
