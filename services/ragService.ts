import OpenAIService from './openaiService';
import PineconeService from './pineconeService';
import { 
  RAGContext, 
  RAGResponse, 
  VectorSearchResult, 
  Source,
  OpenAIConfig,
  PineconeConfig
} from '../types';

class RAGService {
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;
  private isInitialized: boolean = false;

  constructor(openaiConfig: OpenAIConfig, pineconeConfig: PineconeConfig) {
    this.openaiService = new OpenAIService(openaiConfig);
    this.pineconeService = new PineconeService(pineconeConfig);
  }

  /**
   * Initialize the RAG service
   */
  async initialize(): Promise<void> {
    try {
      await this.pineconeService.initialize();
      this.isInitialized = true;
      console.log('RAG service initialized successfully');
    } catch (error) {
      console.error('Error initializing RAG service:', error);
      throw new Error('Failed to initialize RAG service');
    }
  }

  /**
   * Check if the service is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const [openaiValid, pineconeReady] = await Promise.all([
        this.openaiService.validateApiKey(),
        this.pineconeService.isIndexReady()
      ]);

      return openaiValid && pineconeReady;
    } catch (error) {
      console.error('Error checking service readiness:', error);
      return false;
    }
  }

  /**
   * Add documents to the vector database
   */
  async addDocuments(
    documents: Array<{
      id: string;
      text: string;
      metadata: {
        source: string;
        page?: number;
        url?: string;
        timestamp?: string;
      };
    }>
  ): Promise<void> {
    try {
      // Generate embeddings for all documents
      const vectors = await Promise.all(
        documents.map(async (doc) => {
          const embedding = await this.openaiService.generateEmbedding(doc.text);
          return {
            id: doc.id,
            values: embedding,
            metadata: {
              text: doc.text,
              ...doc.metadata,
            },
          };
        })
      );

      // Upsert vectors to Pinecone
      await this.pineconeService.upsertVectors(vectors);
      console.log(`Added ${documents.length} documents to vector database`);
    } catch (error) {
      console.error('Error adding documents:', error);
      throw new Error('Failed to add documents to vector database');
    }
  }

  /**
   * Search for relevant documents
   */
  async searchDocuments(
    query: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<VectorSearchResult[]> {
    try {
      return await this.pineconeService.searchByText(
        query,
        (text) => this.openaiService.generateEmbedding(text),
        { topK, filter }
      );
    } catch (error) {
      console.error('Error searching documents:', error);
      throw new Error('Failed to search documents');
    }
  }

  /**
   * Generate a RAG response
   */
  async generateResponse(
    query: string,
    options?: {
      topK?: number;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      filter?: Record<string, any>;
    }
  ): Promise<RAGResponse> {
    try {
      // Search for relevant documents
      const relevantDocs = await this.searchDocuments(
        query,
        options?.topK || 5,
        options?.filter
      );

      // Create context from relevant documents
      const context = relevantDocs
        .map(doc => doc.metadata.text)
        .join('\n\n');

      // Generate response using OpenAI
      const answer = await this.openaiService.generateRAGResponse(
        query,
        context,
        options?.systemPrompt
      );

      // Extract sources
      const sources: Source[] = relevantDocs.map(doc => ({
        name: doc.metadata.source,
        page: doc.metadata.page || 1,
        url: doc.metadata.url,
        content: doc.metadata.text.substring(0, 200) + '...',
      }));

      // Calculate confidence based on similarity scores
      const confidence = relevantDocs.length > 0 
        ? relevantDocs.reduce((sum, doc) => sum + doc.score, 0) / relevantDocs.length
        : 0;

      return {
        answer,
        sources,
        confidence,
      };
    } catch (error) {
      console.error('Error generating RAG response:', error);
      throw new Error('Failed to generate RAG response');
    }
  }

  /**
   * Generate a streaming RAG response
   */
  async* generateStreamingResponse(
    query: string,
    options?: {
      topK?: number;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      filter?: Record<string, any>;
    }
  ): AsyncGenerator<{ type: 'context' | 'answer' | 'sources' | 'done'; data: any }, void, unknown> {
    try {
      // Search for relevant documents
      const relevantDocs = await this.searchDocuments(
        query,
        options?.topK || 5,
        options?.filter
      );

      // Yield context information
      yield {
        type: 'context',
        data: {
          documentsFound: relevantDocs.length,
          topScores: relevantDocs.map(doc => doc.score),
        }
      };

      // Create context from relevant documents
      const context = relevantDocs
        .map(doc => doc.metadata.text)
        .join('\n\n');

      // Generate streaming response using OpenAI
      let fullAnswer = '';
      for await (const chunk of this.openaiService.generateStreamingRAGResponse(
        query,
        context,
        options?.systemPrompt
      )) {
        fullAnswer += chunk;
        yield {
          type: 'answer',
          data: chunk,
        };
      }

      // Extract sources
      const sources: Source[] = relevantDocs.map(doc => ({
        name: doc.metadata.source,
        page: doc.metadata.page || 1,
        url: doc.metadata.url,
        content: doc.metadata.text.substring(0, 200) + '...',
      }));

      // Yield sources
      yield {
        type: 'sources',
        data: sources,
      };

      // Calculate confidence
      const confidence = relevantDocs.length > 0 
        ? relevantDocs.reduce((sum, doc) => sum + doc.score, 0) / relevantDocs.length
        : 0;

      // Yield final response
      yield {
        type: 'done',
        data: {
          answer: fullAnswer,
          sources,
          confidence,
        }
      };
    } catch (error) {
      console.error('Error generating streaming RAG response:', error);
      throw new Error('Failed to generate streaming RAG response');
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    pineconeStats: any;
    isReady: boolean;
  }> {
    try {
      const [pineconeStats, isReady] = await Promise.all([
        this.pineconeService.getIndexStats(),
        this.isReady()
      ]);

      return {
        pineconeStats,
        isReady,
      };
    } catch (error) {
      console.error('Error getting service stats:', error);
      throw new Error('Failed to get service statistics');
    }
  }

  /**
   * Clear all documents from the vector database
   */
  async clearDatabase(): Promise<void> {
    try {
      await this.pineconeService.deleteAllVectors();
      console.log('Vector database cleared');
    } catch (error) {
      console.error('Error clearing database:', error);
      throw new Error('Failed to clear vector database');
    }
  }

  /**
   * Delete specific documents from the vector database
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      await this.pineconeService.deleteVectors(ids);
      console.log(`Deleted ${ids.length} documents from vector database`);
    } catch (error) {
      console.error('Error deleting documents:', error);
      throw new Error('Failed to delete documents from vector database');
    }
  }
}

export default RAGService;
