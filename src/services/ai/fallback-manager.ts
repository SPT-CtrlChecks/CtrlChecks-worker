// Fallback Manager - Handles model fallbacks and retries

import { modelManager } from './model-manager';

/**
 * Fallback Manager
 * Implements fallback strategies when primary models fail
 */
export class FallbackManager {
  /**
   * Execute with fallback chain
   */
  async withFallback<T>(
    action: (model: string) => Promise<T>,
    primaryModel: string,
    maxRetries: number = 3
  ): Promise<T> {
    const fallbackModels = [
      primaryModel,
      ...modelManager.getFallbackModels(primaryModel),
    ];

    let lastError: Error | null = null;

    for (const model of fallbackModels) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await action(model);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`⚠️  Attempt ${attempt} with model ${model} failed:`, lastError.message);

          if (attempt < maxRetries) {
            // Exponential backoff
            await this.delay(1000 * attempt);
          }
        }
      }
    }

    throw new Error(
      `All fallbacks failed for model ${primaryModel}. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get fallback strategy for a task type
   */
  getFallbackStrategy(taskType: string): string[] {
    const strategies: Record<string, string[]> = {
      'text-generation': ['qwen2.5:3b', 'mistral:7b', 'llama3.1:8b'],
      'code-generation': ['codellama:7b', 'qwen2.5:3b'],
      'image-analysis': ['llava:latest', 'qwen2.5:3b'], // Fallback to text description
      'chat': ['qwen2.5:3b', 'mistral:7b'],
      'summarization': ['qwen2.5:3b', 'mistral:7b'],
      'translation': ['qwen2.5:3b', 'qwen2.5:7b'],
    };

    return strategies[taskType] || ['qwen2.5:3b'];
  }
}

// Export singleton
export const fallbackManager = new FallbackManager();
