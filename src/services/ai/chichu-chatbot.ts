// Chichu - Website AI Chatbot
// Enhanced chatbot with knowledge base and conversation memory

import { ollamaOrchestrator } from './ollama-orchestrator';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Conversation {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatContext {
  message: string;
  history: Conversation[];
  knowledge: any;
  context?: any;
  analysis?: any;
}

interface MessageAnalysis {
  intent: string;
  confidence: number;
  entities: any[];
  requiresAction: boolean;
  suggestedActions?: string[];
}

export class ChichuChatbot {
  private knowledgeBase: any = null;
  private conversationMemory: Map<string, Conversation[]> = new Map();
  private maxHistoryLength = 20;

  constructor() {
    this.loadKnowledgeBase();
  }

  private loadKnowledgeBase(): void {
    try {
      const knowledgePath = join(__dirname, '../../data/website_knowledge.json');
      const knowledgeText = readFileSync(knowledgePath, 'utf-8');
      this.knowledgeBase = JSON.parse(knowledgeText);
      console.log('✅ Chichu knowledge base loaded');
    } catch (error) {
      console.error('❌ Failed to load knowledge base:', error);
      this.knowledgeBase = this.getFallbackKnowledge();
    }
  }

  private getFallbackKnowledge(): any {
    return {
      product: {
        name: 'CtrlChecks',
        description: 'AI-native workflow automation platform',
      },
      faqs: [],
      personality: {
        tone: 'friendly',
        greeting: 'Hello! How can I help you today?',
      },
    };
  }

  async handleMessage(
    sessionId: string,
    message: string,
    context?: any
  ): Promise<{
    response: string;
    analysis: MessageAnalysis;
    suggestedActions?: string[];
    confidence: number;
  }> {
    console.log(`💬 Chichu processing message from session ${sessionId}`);
    
    // 1. Retrieve conversation history
    const history = this.getConversationHistory(sessionId);
    
    // 2. Analyze intent and extract entities
    const analysis = await this.analyzeMessage(message);
    
    // 3. Retrieve relevant knowledge
    const knowledge = await this.retrieveRelevantKnowledge(message, analysis);
    
    // 4. Generate contextual response
    const response = await this.generateResponse({
      message,
      history,
      knowledge,
      context,
      analysis,
    });
    
    // 5. Update conversation memory
    this.updateConversation(sessionId, message, response);
    
    // 6. Execute any actions (if needed)
    if (analysis.requiresAction) {
      // Actions can be handled here if needed
      console.log('🔧 Action required:', analysis.suggestedActions);
    }
    
    return {
      response,
      analysis,
      suggestedActions: analysis.suggestedActions,
      confidence: analysis.confidence,
    };
  }

  async analyzeMessage(message: string): Promise<MessageAnalysis> {
    try {
      const result = await ollamaOrchestrator.processRequest('intent-analysis', {
        message,
        availableIntents: ['question', 'command', 'feedback', 'help', 'custom'],
      });
      
      return {
        intent: result.intent || 'question',
        confidence: result.confidence || 0.7,
        entities: result.entities || [],
        requiresAction: result.requiresAction || false,
        suggestedActions: result.suggestedActions || [],
      };
    } catch (error) {
      console.error('Error analyzing message:', error);
      return {
        intent: 'question',
        confidence: 0.5,
        entities: [],
        requiresAction: false,
      };
    }
  }

  private async retrieveRelevantKnowledge(
    message: string,
    analysis: MessageAnalysis
  ): Promise<any> {
    // Simple keyword matching for now
    // Can be enhanced with embeddings/semantic search
    const keywords = message.toLowerCase().split(/\s+/);
    const relevantFAQs = this.knowledgeBase?.faqs?.filter((faq: any) => {
      const faqText = `${faq.question} ${faq.answer}`.toLowerCase();
      return keywords.some(keyword => faqText.includes(keyword));
    }) || [];
    
    return {
      faqs: relevantFAQs.slice(0, 3), // Top 3 relevant FAQs
      product: this.knowledgeBase?.product,
      features: this.knowledgeBase?.features,
    };
  }

  async generateResponse(context: ChatContext): Promise<string> {
    const prompt = this.buildChatPrompt(context);
    
    try {
      const result = await ollamaOrchestrator.processRequest('chat-generation', {
        prompt,
        system: `You are Chichu, a helpful AI assistant for CtrlChecks workflow platform. 
Be friendly, informative, and concise. Help users build better workflows.
Use the knowledge base provided to answer questions accurately.
If you don't know something, admit it and suggest contacting support.`,
        temperature: 0.7,
        max_tokens: 500,
      });
      
      return this.enhanceResponse(result, context);
    } catch (error) {
      console.error('Error generating response:', error);
      return this.getFallbackResponse(context.message);
    }
  }

  private buildChatPrompt(context: ChatContext): string {
    const { message, history, knowledge, analysis } = context;
    
    let prompt = `You are Chichu, the AI assistant for CtrlChecks.\n\n`;
    
    // Add knowledge base
    if (knowledge.product) {
      prompt += `Product Information:\n`;
      prompt += `- Name: ${knowledge.product.name}\n`;
      prompt += `- Description: ${knowledge.product.description}\n\n`;
    }
    
    // Add relevant FAQs
    if (knowledge.faqs && knowledge.faqs.length > 0) {
      prompt += `Relevant FAQs:\n`;
      knowledge.faqs.forEach((faq: any) => {
        prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
      });
    }
    
    // Add conversation history
    if (history.length > 0) {
      prompt += `Conversation History:\n`;
      history.slice(-5).forEach((conv: Conversation) => {
        prompt += `${conv.role}: ${conv.content}\n`;
      });
      prompt += `\n`;
    }
    
    // Add current message
    prompt += `User: ${message}\n\n`;
    prompt += `Chichu:`;
    
    return prompt;
  }

  private enhanceResponse(response: string, context: ChatContext): string {
    // Post-process response
    let enhanced = response.trim();
    
    // Remove any markdown code blocks if present
    enhanced = enhanced.replace(/```[\s\S]*?```/g, '');
    
    // Ensure response ends properly
    if (!enhanced.match(/[.!?]$/)) {
      enhanced += '.';
    }
    
    return enhanced;
  }

  private getFallbackResponse(message: string): string {
    // Check for FAQ match
    const matchedFAQ = this.findMatchingFAQ(message);
    if (matchedFAQ) {
      return matchedFAQ.answer;
    }
    
    return this.knowledgeBase?.personality?.fallback || 
           "I'm sorry, I'm having trouble understanding that. Could you rephrase your question?";
  }

  private findMatchingFAQ(message: string): any {
    if (!this.knowledgeBase?.faqs) return null;
    
    const keywords = message.toLowerCase().split(/\s+/);
    
    for (const faq of this.knowledgeBase.faqs) {
      const faqKeywords = faq.keywords || [];
      const questionKeywords = faq.question.toLowerCase().split(/\s+/);
      const allKeywords = [...faqKeywords, ...questionKeywords];
      
      const matchCount = keywords.filter(kw => 
        allKeywords.some(fk => fk.includes(kw) || kw.includes(fk))
      ).length;
      
      if (matchCount >= 2) {
        return faq;
      }
    }
    
    return null;
  }

  getConversationHistory(sessionId: string): Conversation[] {
    return this.conversationMemory.get(sessionId) || [];
  }

  private updateConversation(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): void {
    let history = this.conversationMemory.get(sessionId) || [];
    
    // Add user message
    history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });
    
    // Add assistant response
    history.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date().toISOString(),
    });
    
    // Limit history length
    if (history.length > this.maxHistoryLength) {
      history = history.slice(-this.maxHistoryLength);
    }
    
    this.conversationMemory.set(sessionId, history);
  }

  clearConversation(sessionId: string): void {
    this.conversationMemory.delete(sessionId);
  }
}

// Export singleton instance
export const chichuChatbot = new ChichuChatbot();
