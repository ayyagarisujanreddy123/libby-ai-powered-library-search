import OpenAI from 'openai';
import { 
  OpenAIConfig, 
  ChatCompletionMessage, 
  ChatCompletionRequest 
} from '../types';

class OpenAIService {
  private client: OpenAI;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
    });
  }

  /**
   * Generate embeddings for text using OpenAI's embedding model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate a chat completion using OpenAI's chat model
   */
  async generateChatCompletion(
    messages: ChatCompletionMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
        stream: options?.stream || false,
      });

      if (options?.stream) {
        // Handle streaming response
        let fullResponse = '';
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullResponse += content;
        }
        return fullResponse;
      } else {
        return response.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw new Error('Failed to generate chat completion');
    }
  }

  /**
   * Generate a streaming chat completion
   */
  async* generateStreamingChatCompletion(
    messages: ChatCompletionMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error generating streaming chat completion:', error);
      throw new Error('Failed to generate streaming chat completion');
    }
  }

  /**
   * Generate a RAG (Retrieval-Augmented Generation) response
   */
  async generateRAGResponse(
    query: string,
    context: string,
    systemPrompt?: string
  ): Promise<string> {
    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: systemPrompt || `You are Libby, an AI-powered library assistant. 
        Use the provided context to answer questions about library procedures, policies, and guidelines. 
        Be helpful, accurate, and professional. If the context doesn't contain enough information 
        to answer the question, say so and suggest how the user might find more information.`
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nQuestion: ${query}`
      }
    ];

    return this.generateChatCompletion(messages, {
      temperature: 0.3, // Lower temperature for more consistent responses
      maxTokens: 1500
    });
  }

  /**
   * Generate a streaming RAG response
   */
  async* generateStreamingRAGResponse(
    query: string,
    context: string,
    systemPrompt?: string
  ): AsyncGenerator<string, void, unknown> {
    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: systemPrompt || `You are Libby, an AI-powered library assistant. 
        Use the provided context to answer questions about library procedures, policies, and guidelines. 
        Be helpful, accurate, and professional. If the context doesn't contain enough information 
        to answer the question, say so and suggest how the user might find more information.`
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nQuestion: ${query}`
      }
    ];

    yield* this.generateStreamingChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 1500
    });
  }

  /**
   * Check if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }
}

export default OpenAIService;
