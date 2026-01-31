import { 
  PineconeConfig, 
  VectorMetadata, 
  VectorSearchResult, 
  VectorSearchRequest 
} from '../types';

// Detect Safari browser (excluding Chrome-based browsers)
function isSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Check for Safari but exclude Chrome, Edge, and other Chromium-based browsers
  const isSafariUA = /^((?!chrome|android|chromium|edge).)*safari/i.test(ua);
  // Also check for WebKit without Chrome
  const hasWebKit = /webkit/i.test(ua) && !/chrome/i.test(ua) && !/chromium/i.test(ua);
  return isSafariUA || (hasWebKit && /safari/i.test(ua));
}

// Dynamic import for Pinecone to handle browser compatibility
let PineconeClass: any = null;
let useRestAPI = false;

// Check if we should use REST API (Safari or if SDK fails)
if (isSafari()) {
  console.log('Safari detected - using REST API instead of Pinecone SDK');
  useRestAPI = true;
}

async function getPinecone() {
  // Skip SDK in Safari, always use REST API
  if (isSafari() || useRestAPI) {
    return null;
  }
  
  if (!PineconeClass) {
    try {
      const pineconeModule = await import('@pinecone-database/pinecone');
      PineconeClass = pineconeModule.Pinecone;
      console.log('Pinecone SDK loaded successfully');
    } catch (error) {
      console.warn('Failed to load Pinecone SDK, will use REST API fallback:', error);
      useRestAPI = true;
      PineconeClass = null;
    }
  }
  return PineconeClass;
}

// REST API fallback for browser environments
async function queryPineconeREST(
  apiKey: string,
  indexName: string,
  vector: number[],
  topK: number,
  host?: string
): Promise<any> {
  // For serverless indexes, use the host URL directly
  // Format: https://{index-name}-{project-id}.svc.{environment}.pinecone.io/query
  let queryUrl: string;
  
  if (host) {
    // Remove trailing slash if present, then append /query
    const cleanHost = host.trim().replace(/\/+$/, '');
    queryUrl = `${cleanHost}/query`;
  } else {
    // Try to construct from index name and environment (may not work for all setups)
    const env = import.meta.env.VITE_PINECONE_ENVIRONMENT || 'us-east-1';
    queryUrl = `https://${indexName}.svc.${env}.pinecone.io/query`;
  }
  
  console.log('Using Pinecone REST API:', queryUrl);
  console.log('Vector dimension:', vector.length);
  console.log('TopK:', topK);
  
  try {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
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
      console.error('Pinecone REST API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Pinecone REST API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Pinecone REST API response received:', {
      matches: data.matches?.length || 0
    });
    return data;
  } catch (error) {
    console.error('Pinecone REST API fetch error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to Pinecone. Please check your internet connection and CORS settings.');
    }
    throw error;
  }
}

class PineconeService {
  private client: any;
  private index: any;
  private config: PineconeConfig;
  private isInitialized: boolean = false;

  constructor(config: PineconeConfig) {
    this.config = config;
  }

  private async ensureClient() {
    // In Safari or if REST API is preferred, skip client initialization
    if (isSafari() || useRestAPI) {
      return; // Will use REST API directly
    }
    
    if (!this.client) {
      const Pinecone = await getPinecone();
      if (Pinecone) {
        // Pinecone v2.x only needs API key, environment is no longer used
        this.client = new Pinecone({
          apiKey: this.config.apiKey,
        });
      } else {
        useRestAPI = true;
      }
    }
  }

  /**
   * Initialize the Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      // In Safari, skip SDK initialization and use REST API directly
      if (isSafari() || useRestAPI) {
        console.log('Using REST API mode (Safari or SDK unavailable)');
        this.isInitialized = true;
        
        // Verify configuration
        const apiHost = this.config.host || 
          `https://${this.config.indexName}.svc.${this.config.environment || 'us-east-1'}.pinecone.io`;
        console.log('Pinecone REST API configuration:');
        console.log('  - Host URL:', apiHost);
        console.log('  - Index name:', this.config.indexName);
        console.log('  - Environment:', this.config.environment || 'us-east-1');
        console.log('  - API Key:', this.config.apiKey ? `${this.config.apiKey.substring(0, 9)}...` : 'Not set');
        return;
      }
      
      await this.ensureClient();
      if (!this.client) {
        useRestAPI = true;
        this.isInitialized = true;
        return;
      }
      
      this.index = this.client.index(this.config.indexName);
      console.log('Pinecone index initialized (SDK mode):', this.config.indexName);
      this.isInitialized = true;
      
      // Verify the index is accessible
      try {
        const stats = await this.index.describeIndexStats();
        console.log('Pinecone index stats:', {
          totalVectors: stats.totalRecordCount || stats.totalVectorCount || 0,
          dimension: stats.dimension,
          indexFullness: stats.indexFullness
        });
      } catch (statsError) {
        console.warn('Could not fetch index stats (index might be empty or not ready):', statsError);
      }
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      console.warn('Falling back to REST API mode');
      useRestAPI = true;
      this.isInitialized = true;
    }
  }

  /**
   * Check if the index exists and is ready
   */
  async isIndexReady(): Promise<boolean> {
    try {
      const stats = await this.index.describeIndexStats();
      return stats.totalVectorCount !== undefined;
    } catch (error) {
      console.error('Error checking index status:', error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      return await this.index.describeIndexStats();
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
      await this.index.upsert(vectors);
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
      
      const searchRequest = {
        vector: request.vector,
        topK: request.topK || 5,
        includeMetadata: request.includeMetadata !== false,
        filter: request.filter,
      };

      console.log('Executing Pinecone query with vector dimension:', searchRequest.vector.length);
      
      // Use REST API if Safari or SDK not available, otherwise try SDK first
      let response: any;
      const host = this.config.host || 
        `https://${this.config.indexName}.svc.${this.config.environment || 'us-east-1'}.pinecone.io`;
      
      if (isSafari() || useRestAPI || !this.index) {
        // Use REST API directly (Safari or fallback)
        console.log('Using REST API for Pinecone query (Safari or fallback)');
        response = await queryPineconeREST(
          this.config.apiKey,
          this.config.indexName,
          searchRequest.vector,
          searchRequest.topK || 5,
          host
        );
      } else {
        // Try SDK first
        try {
          response = await this.index.query(searchRequest);
          console.log('Pinecone SDK query successful');
        } catch (sdkError) {
          console.warn('Pinecone SDK query failed, falling back to REST API:', sdkError);
          useRestAPI = true;
          response = await queryPineconeREST(
            this.config.apiKey,
            this.config.indexName,
            searchRequest.vector,
            searchRequest.topK || 5,
            host
          );
        }
      }
      
      console.log('Pinecone query response:', JSON.stringify(response, null, 2));
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw error; // Re-throw to let searchByText handle it with better context
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
      
      // Check for CORS errors
      if (errorMessage.includes('CORS') || errorMessage.includes('fetch') || errorMessage.includes('NetworkError')) {
        throw new Error(`CORS Error: Pinecone API cannot be called directly from the browser. You need a backend proxy. Details: ${errorMessage}`);
      }
      
      // Check for authentication errors
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('API key')) {
        throw new Error(`Authentication Error: Invalid Pinecone API key. Please check your VITE_PINECONE_API_KEY. Details: ${errorMessage}`);
      }
      
      // Check for index errors
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
      await this.index.deleteMany(ids);
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
      await this.index.deleteAll();
      console.log('Deleted all vectors from index');
    } catch (error) {
      console.error('Error deleting all vectors:', error);
      throw new Error('Failed to delete all vectors');
    }
  }

  /**
   * Update vector metadata
   */
  async updateVectorMetadata(
    id: string,
    metadata: Partial<VectorMetadata>
  ): Promise<void> {
    try {
      // Pinecone doesn't have a direct update metadata method
      // We need to fetch the vector, update metadata, and upsert
      const fetchResponse = await this.index.fetch([id]);
      const existingVector = fetchResponse.vectors[id];
      
      if (existingVector) {
        const updatedVector = {
          id,
          values: existingVector.values,
          metadata: { ...existingVector.metadata, ...metadata },
        };
        
        await this.index.upsert([updatedVector]);
        console.log(`Updated metadata for vector ${id}`);
      } else {
        throw new Error(`Vector with id ${id} not found`);
      }
    } catch (error) {
      console.error('Error updating vector metadata:', error);
      throw new Error('Failed to update vector metadata');
    }
  }

  /**
   * Fetch vectors by IDs
   */
  async fetchVectors(ids: string[]): Promise<Record<string, any>> {
    try {
      const response = await this.index.fetch(ids);
      return response.vectors;
    } catch (error) {
      console.error('Error fetching vectors:', error);
      throw new Error('Failed to fetch vectors');
    }
  }

  /**
   * Create a new index (if it doesn't exist)
   */
  async createIndex(
    dimension: number = 1536, // Default for OpenAI embeddings
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ): Promise<void> {
    try {
      await this.client.createIndex({
        name: this.config.indexName,
        dimension,
        metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
      console.log(`Created index: ${this.config.indexName}`);
    } catch (error) {
      console.error('Error creating index:', error);
      throw new Error('Failed to create index');
    }
  }

  /**
   * List all indexes
   */
  async listIndexes(): Promise<string[]> {
    try {
      const response = await this.client.listIndexes();
      return response.indexes?.map((index: any) => index.name) || [];
    } catch (error) {
      console.error('Error listing indexes:', error);
      throw new Error('Failed to list indexes');
    }
  }

  /**
   * Delete the index
   */
  async deleteIndex(): Promise<void> {
    try {
      await this.client.deleteIndex(this.config.indexName);
      console.log(`Deleted index: ${this.config.indexName}`);
    } catch (error) {
      console.error('Error deleting index:', error);
      throw new Error('Failed to delete index');
    }
  }
}

export default PineconeService;
