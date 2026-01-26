// Multimodal Processors
// Text, Image, and Audio processing with Ollama

import { ollamaOrchestrator } from '../ollama-orchestrator';
import { ollamaManager } from '../ollama-manager';

export type TextAnalysisType = 
  | 'sentiment'
  | 'entity-extraction'
  | 'summarization'
  | 'translation'
  | 'classification'
  | 'keywords';

export type AudioAnalysisType = 
  | 'transcription'
  | 'sentiment'
  | 'speaker-diarization';

export interface MultimodalInput {
  text?: string;
  images?: string[];
  audio?: string;
  context?: any;
  processingTypes?: string[];
}

export class MultimodalProcessor {
  private textProcessor: TextProcessor;
  private imageProcessor: ImageProcessor;
  private audioProcessor: AudioProcessor;

  constructor() {
    this.textProcessor = new TextProcessor();
    this.imageProcessor = new ImageProcessor();
    this.audioProcessor = new AudioProcessor();
  }

  async process(input: MultimodalInput): Promise<any> {
    const results: any = {};
    
    // Process text if present
    if (input.text) {
      results.text = await this.processText(input.text, input.context, input.processingTypes);
    }
    
    // Process images if present
    if (input.images && input.images.length > 0) {
      results.images = await Promise.all(
        input.images.map(img => this.processImage(img, input.context))
      );
    }
    
    // Process audio if present
    if (input.audio) {
      results.audio = await this.processAudio(input.audio, input.context);
    }
    
    // Combine insights if multimodal context
    if (Object.keys(results).length > 1) {
      results.combined = await this.combineInsights(results);
    }
    
    return results;
  }

  private async processText(
    text: string,
    context?: any,
    processingTypes?: string[]
  ): Promise<any> {
    const result: any = {};
    
    const types = processingTypes || ['sentiment', 'entities', 'summary'];
    
    if (types.includes('sentiment')) {
      result.sentiment = await this.textProcessor.analyzeSentiment(text);
    }
    
    if (types.includes('entities')) {
      result.entities = await this.textProcessor.extractEntities(text);
    }
    
    if (types.includes('summary')) {
      result.summary = await this.textProcessor.summarize(text);
    }
    
    if (types.includes('keywords')) {
      result.keywords = await this.textProcessor.extractKeywords(text);
    }
    
    return result;
  }

  private async processImage(imageBase64: string, context?: any): Promise<any> {
    return await this.imageProcessor.describe(imageBase64, 'detailed');
  }

  private async processAudio(audioBase64: string, context?: any): Promise<any> {
    return await this.audioProcessor.transcribe(audioBase64);
  }

  private async combineInsights(results: any): Promise<any> {
    // Use AI to combine insights from multiple modalities
    const prompt = `Combine insights from the following analysis:
${JSON.stringify(results, null, 2)}

Provide a unified analysis that connects insights from different modalities.`;
    
    try {
      const combined = await ollamaOrchestrator.processRequest('text-analysis', {
        prompt,
        temperature: 0.5,
      });
      
      return {
        analysis: combined,
        modalities: Object.keys(results),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error combining insights:', error);
      return {
        modalities: Object.keys(results),
        note: 'Could not combine insights automatically',
      };
    }
  }
}

export class TextProcessor {
  async analyze(text: string, analysisType: TextAnalysisType, options?: any): Promise<any> {
    const model = this.selectModelForAnalysis(analysisType);
    
    const prompt = this.buildAnalysisPrompt(text, analysisType, options);
    
    try {
      const result = await ollamaOrchestrator.processRequest('text-analysis', {
        prompt,
        model,
        temperature: 0.3,
        max_tokens: 500,
      });
      
      return this.validateAndFormat(result, analysisType);
    } catch (error) {
      console.error(`Error in ${analysisType} analysis:`, error);
      throw error;
    }
  }

  async extractEntities(text: string): Promise<any> {
    return this.analyze(text, 'entity-extraction');
  }

  async summarize(text: string, length: 'short' | 'medium' | 'long' = 'medium'): Promise<string> {
    const result = await this.analyze(text, 'summarization', { length });
    return typeof result === 'string' ? result : result.summary || result;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    const result = await ollamaOrchestrator.processRequest('text-analysis', {
      prompt: `Translate the following text to ${targetLanguage}:\n\n${text}`,
      temperature: 0.3,
    });
    
    return typeof result === 'string' ? result : result.translation || text;
  }

  async analyzeSentiment(text: string): Promise<{ sentiment: string; score: number }> {
    const prompt = `Analyze the sentiment of this text and respond with JSON:
{
  "sentiment": "positive|negative|neutral",
  "score": 0.0-1.0
}

Text: "${text}"`;
    
    try {
      const result = await ollamaOrchestrator.processRequest('text-analysis', {
        prompt,
        temperature: 0.2,
      });
      
      // Try to parse JSON response
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        return {
          sentiment: parsed.sentiment || 'neutral',
          score: parsed.score || 0.5,
        };
      } catch {
        // Fallback: simple keyword matching
        const lowerText = text.toLowerCase();
        if (lowerText.match(/\b(good|great|excellent|amazing|love|happy)\b/)) {
          return { sentiment: 'positive', score: 0.7 };
        } else if (lowerText.match(/\b(bad|terrible|awful|hate|sad|angry)\b/)) {
          return { sentiment: 'negative', score: 0.7 };
        }
        return { sentiment: 'neutral', score: 0.5 };
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  async extractKeywords(text: string, maxKeywords: number = 10): Promise<string[]> {
    const prompt = `Extract the most important keywords from this text (max ${maxKeywords}):
${text}

Respond with a JSON array of keywords.`;
    
    try {
      const result = await ollamaOrchestrator.processRequest('text-analysis', {
        prompt,
        temperature: 0.2,
      });
      
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        const keywords = Array.isArray(parsed) ? parsed : parsed.keywords || [];
        return keywords.slice(0, maxKeywords);
      } catch {
        // Fallback: simple extraction
        const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const unique = [...new Set(words)];
        return unique.slice(0, maxKeywords);
      }
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }

  private selectModelForAnalysis(analysisType: TextAnalysisType): string {
    // Use appropriate model based on analysis type
    return 'qwen2.5:3b'; // Default to fast model
  }

  private buildAnalysisPrompt(text: string, analysisType: TextAnalysisType, options?: any): string {
    switch (analysisType) {
      case 'entity-extraction':
        return `Extract entities (people, places, organizations, dates) from this text:
${text}

Respond with JSON: { "entities": [{ "type": "...", "value": "..." }] }`;
      
      case 'summarization':
        const length = options?.length || 'medium';
        return `Summarize this text in a ${length} format:
${text}`;
      
      case 'classification':
        return `Classify this text into one of these categories: ${options?.categories?.join(', ') || 'general'}.
Text: ${text}`;
      
      default:
        return text;
    }
  }

  private validateAndFormat(result: any, analysisType: TextAnalysisType): any {
    // Validate and format the result based on analysis type
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }
}

export class ImageProcessor {
  async describe(
    imageBase64: string,
    detailLevel: 'brief' | 'detailed' | 'technical' = 'detailed'
  ): Promise<{
    description: string;
    extractedText?: string;
    objects?: string[];
    colors?: string[];
  }> {
    const prompt = this.buildImagePrompt(detailLevel);
    
    try {
      const result = await ollamaManager.multimodal(
        imageBase64,
        prompt,
        { model: 'llava:latest' }
      );
      
      // Extract content string from result
      const description = typeof result === 'string' 
        ? result 
        : result.content || '';
      
      return {
        description,
        extractedText: await this.extractTextFromImage(imageBase64),
        objects: await this.detectObjects(imageBase64),
        colors: await this.analyzeColors(imageBase64),
      };
    } catch (error) {
      console.error('Error describing image:', error);
      throw error;
    }
  }

  async compareImages(
    images: string[],
    comparisonType: 'similarity' | 'differences' | 'progression'
  ): Promise<any> {
    // Process multiple images and compare
    const descriptions = await Promise.all(
      images.map(img => this.describe(img, 'detailed'))
    );
    
    const comparisonPrompt = this.buildComparisonPrompt(descriptions, comparisonType);
    
    try {
      return await ollamaOrchestrator.processRequest('image-comparison', {
        prompt: comparisonPrompt,
        context: { images: descriptions.length, comparisonType },
      });
    } catch (error) {
      console.error('Error comparing images:', error);
      return {
        error: 'Could not compare images',
        descriptions,
      };
    }
  }

  private buildImagePrompt(detailLevel: 'brief' | 'detailed' | 'technical'): string {
    switch (detailLevel) {
      case 'brief':
        return 'Briefly describe what you see in this image.';
      case 'technical':
        return 'Provide a technical analysis of this image, including composition, colors, objects, and any text present.';
      case 'detailed':
      default:
        return 'Describe this image in detail, including objects, people, text, colors, and the overall scene.';
    }
  }

  private async extractTextFromImage(imageBase64: string): Promise<string> {
    try {
      const result = await ollamaManager.multimodal(
        imageBase64,
        'Extract all text visible in this image. Return only the text, no descriptions.',
        { model: 'llava:latest' }
      );
      return result.content || '';
    } catch (error) {
      console.error('Error extracting text from image:', error);
      return '';
    }
  }

  private async detectObjects(imageBase64: string): Promise<string[]> {
    try {
      const result = await ollamaManager.multimodal(
        imageBase64,
        'List all objects you can identify in this image. Return a JSON array of object names.',
        { model: 'llava:latest' }
      );
      
      try {
        const parsed = typeof result.content === 'string' 
          ? JSON.parse(result.content) 
          : result.content;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Error detecting objects:', error);
      return [];
    }
  }

  private async analyzeColors(imageBase64: string): Promise<string[]> {
    try {
      const result = await ollamaManager.multimodal(
        imageBase64,
        'Identify the dominant colors in this image. Return a JSON array of color names.',
        { model: 'llava:latest' }
      );
      
      try {
        const parsed = typeof result.content === 'string' 
          ? JSON.parse(result.content) 
          : result.content;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Error analyzing colors:', error);
      return [];
    }
  }

  private buildComparisonPrompt(
    descriptions: any[],
    comparisonType: 'similarity' | 'differences' | 'progression'
  ): string {
    const descText = descriptions.map((d, i) => `Image ${i + 1}: ${d.description}`).join('\n\n');
    
    switch (comparisonType) {
      case 'similarity':
        return `Compare these images and identify similarities:\n\n${descText}`;
      case 'differences':
        return `Compare these images and identify differences:\n\n${descText}`;
      case 'progression':
        return `Analyze the progression or sequence in these images:\n\n${descText}`;
      default:
        return `Compare these images:\n\n${descText}`;
    }
  }
}

export class AudioProcessor {
  async transcribe(audioBase64: string, language?: string): Promise<{
    transcription: string;
    language?: string;
    segments?: any[];
    confidence?: number;
  }> {
    // Note: Whisper model may not be available in all Ollama setups
    // This is a placeholder for when audio transcription is available
    try {
      // Try to use whisper if available
      const result = await ollamaManager.generate(
        `Transcribe this audio: ${audioBase64.substring(0, 100)}...`,
        { model: 'whisper' }
      );
      
      return {
        transcription: result.content || '',
        language: language || 'en',
        confidence: 0.8,
      };
    } catch (error) {
      console.warn('Audio transcription not available:', error);
      return {
        transcription: '[Audio transcription not available - Whisper model required]',
        language: language || 'en',
        confidence: 0,
      };
    }
  }

  async analyzeAudio(
    audioBase64: string,
    analysisType: AudioAnalysisType
  ): Promise<any> {
    const transcription = await this.transcribe(audioBase64);
    
    if (analysisType === 'sentiment') {
      // Use text processor to analyze transcribed text
      const textProcessor = new TextProcessor();
      const sentiment = await textProcessor.analyzeSentiment(transcription.transcription);
      return {
        ...transcription,
        sentiment,
      };
    }
    
    return transcription;
  }
}

// Export singleton instance
export const multimodalProcessor = new MultimodalProcessor();
