import { Pinecone } from '@pinecone-database/pinecone';
import { 
  PineconeConfig, 
  VectorMetadata, 
  VectorSearchResult, 
  VectorSearchRequest 
} from '../types';

class PineconeService {
  private client: Pinecone;
  private index: any;
  private config: PineconeConfig;

  constructor(config: PineconeConfig) {
    this.config = config;
    this.client = new Pinecone({
      apiKey: config.apiKey,
      environment: config.environment,
    });
  }

  /**
   * Initialize the Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      this.index = this.client.index(this.config.indexName);
      console.log('Pinecone index initialized:', this.config.indexName);
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      throw new Error('Failed to initialize Pinecone index');
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
      const searchRequest = {
        vector: request.vector,
        topK: request.topK || 5,
        includeMetadata: request.includeMetadata !== false,
        filter: request.filter,
      };

      const response = await this.index.query(searchRequest);
      
      return response.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as VectorMetadata,
      }));
    } catch (error) {
      console.error('Error searching vectors:', error);
      throw new Error('Failed to search vectors');
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
      const embedding = await embeddingFunction(text);
      return this.searchVectors({
        vector: embedding,
        topK: options?.topK || 5,
        filter: options?.filter,
      });
    } catch (error) {
      console.error('Error searching by text:', error);
      throw new Error('Failed to search by text');
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
