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
      console.log('RAGService: Searching documents for query:', query);
      const results = await this.pineconeService.searchByText(
        query,
        (text) => this.openaiService.generateEmbedding(text),
        { topK, filter }
      );
      console.log('RAGService: Search completed, found', results.length, 'results');
      return results;
    } catch (error) {
      console.error('RAGService: Error searching documents:', error);
      // Re-throw with original error message for better debugging
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to search documents: ${String(error)}`);
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
      console.log('Searching Pinecone for query:', query);
      
      // Search for relevant documents - increase topK to get more results
      const topK = options?.topK || 10; // Increased from 5 to get more results
      console.log(`Searching with topK=${topK}`);
      
      const relevantDocs = await this.searchDocuments(
        query,
        topK,
        options?.filter
      );

      console.log(`Found ${relevantDocs.length} relevant documents from Pinecone`);
      
      // Filter out very low similarity scores (but be lenient)
      const filteredDocs = relevantDocs.filter(doc => (doc.score || 0) > 0.3); // Lower threshold
      console.log(`After filtering (score > 0.3): ${filteredDocs.length} documents`);
      
      // Use filtered docs or all docs if filtered is empty
      const docsToUse = filteredDocs.length > 0 ? filteredDocs : relevantDocs;
      
      // Log details about the documents found
      docsToUse.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, {
          id: doc.id,
          score: doc.score,
          hasText: !!doc.metadata?.text,
          textLength: doc.metadata?.text?.length || 0,
          metadataKeys: Object.keys(doc.metadata || {}),
          source: doc.metadata?.source,
          fullMetadata: doc.metadata, // Log full metadata to see structure
        });
      });

      // Create context from relevant documents
      // NOTE: If metadata doesn't have text, we need to fetch it or reconstruct it
      let context = '';
      
      if (docsToUse.length > 0) {
        // Check if we have text in metadata
        const hasText = docsToUse.some(doc => doc.metadata?.text || doc.metadata?.content);
        
        if (!hasText) {
          console.warn('⚠️  WARNING: Vectors in Pinecone do not have text content in metadata!');
          console.warn('   Metadata only contains:', Object.keys(docsToUse[0]?.metadata || {}));
          console.warn('   This means the text content was not stored when indexing.');
          console.warn('   You need to re-index your documents with text content in metadata.');
          console.warn('   For now, using vector IDs and sources as context...');
          
          // Create a minimal context from what we have
          context = docsToUse.map((doc, i) => {
            return `Document ${i + 1} (ID: ${doc.id}, Source: ${doc.metadata?.source || 'Unknown'}, Similarity: ${(doc.score || 0).toFixed(3)})`;
          }).join('\n\n');
        } else {
          // Normal case: extract text from metadata
          context = docsToUse
            .map(doc => {
              const text = doc.metadata?.text || 
                           doc.metadata?.content || 
                           doc.metadata?.document || 
                           doc.metadata?.chunk ||
                           '';
              return text;
            })
            .filter(text => text && text.trim().length > 0)
            .join('\n\n');
        }
      }
      
      console.log(`Context created, length: ${context.length} characters`);

      // If no documents found or no text in metadata, provide a helpful message
      if (docsToUse.length === 0) {
        console.warn('No documents found in Pinecone search');
      } else if (!context.trim()) {
        console.warn('Documents found but no text content in metadata. Metadata structure:', 
          docsToUse[0]?.metadata ? Object.keys(docsToUse[0].metadata) : 'no metadata');
        console.warn('Full first document metadata:', JSON.stringify(docsToUse[0]?.metadata, null, 2));
      }
      
      if (docsToUse.length === 0) {
        const noResultsPrompt = `You are Libby, a helpful AI assistant for library staff. 

A user asked: "${query}", but no relevant information was found in the library documents database.

Provide a brief, polite response (2-3 sentences) saying you couldn't find specific information on this topic and suggest they could rephrase the question or contact library staff for assistance. Be concise and helpful. Use numbered lists (1, 2, 3) if listing multiple points - NEVER use asterisks (*) or bullet points.`;
        
        const answer = await this.openaiService.generateChatCompletion([
          {
            role: 'system',
            content: noResultsPrompt,
          },
          {
            role: 'user',
            content: `User question: "${query}"`,
          },
        ]);

        return {
          answer,
          sources: [],
          confidence: 0,
        };
      }

      // If we have documents but no text content, create a helpful response
      if (!context.trim() || context.length < 50) {
        console.warn('⚠️  Documents found but no text content available in metadata');
        const sourcesList = docsToUse.map((doc, i) => 
          `${i + 1}. ${doc.metadata?.source || doc.id} (similarity: ${(doc.score || 0).toFixed(2)})`
        ).join('\n');
        
        const noTextPrompt = `You are Libby, a helpful AI assistant for library staff. 

A user asked: "${query}"

I found ${docsToUse.length} relevant document(s): ${docsToUse.map(d => d.metadata?.source || d.id).join(', ')}

The document content is not available in the database. Provide a brief, helpful response (2-3 sentences) guiding the user to refer to these documents for detailed information. Be concise and direct. Use numbered lists (1, 2, 3) if listing multiple points - NEVER use asterisks (*) or bullet points.`;

        const answer = await this.openaiService.generateChatCompletion([
          {
            role: 'system',
            content: noTextPrompt,
          },
          {
            role: 'user',
            content: `User question: "${query}"`,
          },
        ]);

        return {
          answer,
          sources: docsToUse.map(doc => ({
            name: doc.metadata?.source || doc.id,
            page: doc.metadata?.page || 1,
            url: doc.metadata?.url,
            content: '',
          })),
          confidence: docsToUse.reduce((sum, doc) => sum + (doc.score || 0), 0) / docsToUse.length,
        };
      }

      // Generate response using OpenAI with context
      // Enhanced system prompt for concise, organized responses
      const enhancedSystemPrompt = options?.systemPrompt || `You are Libby, a helpful AI assistant for library staff. 

IMPORTANT: Provide concise, well-organized answers using the context from library documents.

Your response should:
- Start with a direct answer to the question (1-2 sentences)
- Use bullet points for procedures, steps, or lists
- Include only the most important and relevant information
- Be brief (aim for 100-200 words maximum)
- Stay focused on what directly answers the question
- Organize information clearly (avoid long paragraphs)

If the context doesn't fully answer the question, briefly state what information is available.`;

      const answer = await this.openaiService.generateRAGResponse(
        query,
        context,
        enhancedSystemPrompt
      );

      // Extract sources
      const sources: Source[] = docsToUse.map(doc => ({
        name: doc.metadata?.source || doc.metadata?.document || doc.metadata?.file || 'Unknown',
        page: doc.metadata?.page || doc.metadata?.pageNumber || 1,
        url: doc.metadata?.url || doc.metadata?.link,
        content: (doc.metadata?.text || doc.metadata?.content || doc.metadata?.chunk || '').substring(0, 200) + '...',
      }));

      // Calculate confidence based on similarity scores
      const confidence = docsToUse.length > 0 
        ? docsToUse.reduce((sum, doc) => sum + (doc.score || 0), 0) / docsToUse.length
        : 0;

      console.log(`Generated RAG response with ${sources.length} sources, confidence: ${confidence.toFixed(2)}`);

      return {
        answer,
        sources,
        confidence,
      };
    } catch (error) {
      console.error('Error generating RAG response:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate RAG response: ${errorMessage}`);
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
