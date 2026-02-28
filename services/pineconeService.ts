import {
  PineconeConfig,
  VectorMetadata,
  VectorSearchResult,
  VectorSearchRequest
} from '../types';

// In browser environments, Pinecone requests are routed through the Vite dev server
// proxy at /api/pinecone to bypass CORS restrictions. The proxy forwards requests
// to the actual Pinecone host and injects the API key server-side.
const PROXY_BASE = '/api/pinecone';

// REST API via proxy for browser environments
async function queryPineconeREST(
  vector: number[],
  topK: number
): Promise<any> {
  const queryUrl = `${PROXY_BASE}/query`;

  console.log('Using Pinecone via proxy:', queryUrl);
  console.log('Vector dimension:', vector.length);
  console.log('TopK:', topK);

  try {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector,
        topK,
        includeMetadata: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinecone API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Pinecone API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Pinecone API response received:', {
      matches: data.matches?.length || 0
    });
    return data;
  } catch (error) {
    console.error('Pinecone API fetch error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to Pinecone. Please check your internet connection.');
    }
    throw error;
  }
}

class PineconeService {
  private config: PineconeConfig;
  private isInitialized: boolean = false;

  constructor(config: PineconeConfig) {
    this.config = config;
  }

  /**
   * Initialize the Pinecone service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Pinecone (browser proxy mode)');
      this.isInitialized = true;

      console.log('Pinecone configuration:');
      console.log('  - Index name:', this.config.indexName);
      console.log('  - Proxy endpoint:', PROXY_BASE);
      console.log('  - API Key:', this.config.apiKey ? `${this.config.apiKey.substring(0, 9)}...` : 'Not set');
    } catch (error) {
      console.error('Error initializing Pinecone:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Check if the index exists and is ready
   */
  async isIndexReady(): Promise<boolean> {
    return this.isInitialized;
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const response = await fetch(`${PROXY_BASE}/describe_index_stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to get index stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw new Error('Failed to get index statistics');
    }
  }

  /**
   * Upsert vectors to the index
   */
  async upsertVectors(
    vectors: Array<{
      id: string;
      values: number[];
      metadata: VectorMetadata;
    }>
  ): Promise<void> {
    try {
      const response = await fetch(`${PROXY_BASE}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vectors }),
      });

      if (!response.ok) {
        throw new Error(`Failed to upsert vectors: ${response.status}`);
      }

      console.log(`Upserted ${vectors.length} vectors to index`);
    } catch (error) {
      console.error('Error upserting vectors:', error);
      throw new Error('Failed to upsert vectors');
    }
  }

  /**
   * Search for similar vectors
   */
  async searchVectors(
    request: VectorSearchRequest
  ): Promise<VectorSearchResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Executing Pinecone query with vector dimension:', request.vector.length);

      const response = await queryPineconeREST(
        request.vector,
        request.topK || 5
      );

      if (!response || !response.matches) {
        console.warn('Pinecone returned empty or invalid response:', response);
        return [];
      }

      console.log(`Pinecone returned ${response.matches.length} matches`);
      response.matches.forEach((match: any, index: number) => {
        console.log(`Match ${index + 1}:`, {
          id: match.id,
          score: match.score,
          hasMetadata: !!match.metadata,
          metadataKeys: match.metadata ? Object.keys(match.metadata) : [],
        });
      });

      const results = response.matches.map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as VectorMetadata,
      }));

      console.log('Processed results:', results.length);
      return results;
    } catch (error) {
      console.error('Error searching vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors with text query (requires embedding)
   */
  async searchByText(
    text: string,
    embeddingFunction: (text: string) => Promise<number[]>,
    options?: {
      topK?: number;
      filter?: Record<string, any>;
    }
  ): Promise<VectorSearchResult[]> {
    try {
      console.log('Generating embedding for query:', text.substring(0, 50) + '...');
      const embedding = await embeddingFunction(text);
      console.log('Embedding generated, dimension:', embedding.length);

      if (!this.isInitialized) {
        await this.initialize();
      }

      const results = await this.searchVectors({
        vector: embedding,
        topK: options?.topK || 5,
        filter: options?.filter,
      });

      console.log(`Pinecone search returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Error searching by text:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('API key')) {
        throw new Error(`Authentication Error: Invalid Pinecone API key. Please check your VITE_PINECONE_API_KEY. Details: ${errorMessage}`);
      }

      if (errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('index')) {
        throw new Error(`Index Error: Pinecone index "${this.config.indexName}" not found. Please verify the index name in your .env file. Details: ${errorMessage}`);
      }

      throw new Error(`Failed to search by text: ${errorMessage}. ${errorStack ? `Stack: ${errorStack.substring(0, 200)}` : ''}`);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(ids: string[]): Promise<void> {
    try {
      const response = await fetch(`${PROXY_BASE}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete vectors: ${response.status}`);
      }

      console.log(`Deleted ${ids.length} vectors from index`);
    } catch (error) {
      console.error('Error deleting vectors:', error);
      throw new Error('Failed to delete vectors');
    }
  }

  /**
   * Delete all vectors in the index
   */
  async deleteAllVectors(): Promise<void> {
    try {
      const response = await fetch(`${PROXY_BASE}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteAll: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete all vectors: ${response.status}`);
      }

      console.log('Deleted all vectors from index');
    } catch (error) {
      console.error('Error deleting all vectors:', error);
      throw new Error('Failed to delete all vectors');
    }
  }
}

export default PineconeService;
