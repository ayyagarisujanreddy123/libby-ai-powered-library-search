import { OpenAIConfig, PineconeConfig } from '../types';

class ConfigService {
  private static instance: ConfigService;
  private openaiConfig: OpenAIConfig | null = null;
  private pineconeConfig: PineconeConfig | null = null;

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): void {
    try {
      // OpenAI Configuration
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      const openaiModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';
      const embeddingModel = import.meta.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';

      if (!openaiApiKey) {
        console.warn('OpenAI API key not found in environment variables');
      } else {
        this.openaiConfig = {
          apiKey: openaiApiKey,
          model: openaiModel,
          embeddingModel: embeddingModel,
        };
      }

      // Pinecone Configuration
      const pineconeApiKey = import.meta.env.VITE_PINECONE_API_KEY;
      const pineconeEnvironment = import.meta.env.VITE_PINECONE_ENVIRONMENT;
      const pineconeIndexName = import.meta.env.VITE_PINECONE_INDEX_NAME || 'libby-library-search';
      const pineconeHost = import.meta.env.VITE_PINECONE_HOST; // Optional: full host URL for REST API

      if (!pineconeApiKey || !pineconeEnvironment) {
        console.warn('Pinecone API key or environment not found in environment variables');
      } else {
        this.pineconeConfig = {
          apiKey: pineconeApiKey,
          environment: pineconeEnvironment,
          indexName: pineconeIndexName,
          host: pineconeHost, // Use host URL if provided, otherwise will be constructed
        };
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }

  /**
   * Get OpenAI configuration
   */
  public getOpenAIConfig(): OpenAIConfig | null {
    return this.openaiConfig;
  }

  /**
   * Get Pinecone configuration
   */
  public getPineconeConfig(): PineconeConfig | null {
    return this.pineconeConfig;
  }

  /**
   * Check if OpenAI is configured
   */
  public isOpenAIConfigured(): boolean {
    return this.openaiConfig !== null && !!this.openaiConfig.apiKey;
  }

  /**
   * Check if Pinecone is configured
   */
  public isPineconeConfigured(): boolean {
    return this.pineconeConfig !== null && 
           !!this.pineconeConfig.apiKey && 
           !!this.pineconeConfig.environment;
  }

  /**
   * Check if all services are configured
   */
  public isFullyConfigured(): boolean {
    return this.isOpenAIConfigured() && this.isPineconeConfigured();
  }

  /**
   * Get configuration status
   */
  public getConfigStatus(): {
    openai: boolean;
    pinecone: boolean;
    fullyConfigured: boolean;
    missingConfigs: string[];
  } {
    const openai = this.isOpenAIConfigured();
    const pinecone = this.isPineconeConfigured();
    const fullyConfigured = this.isFullyConfigured();
    
    const missingConfigs: string[] = [];
    if (!openai) {
      missingConfigs.push('OpenAI API key');
    }
    if (!pinecone) {
      missingConfigs.push('Pinecone API key and environment');
    }

    return {
      openai,
      pinecone,
      fullyConfigured,
      missingConfigs,
    };
  }

  /**
   * Update OpenAI configuration
   */
  public updateOpenAIConfig(config: Partial<OpenAIConfig>): void {
    if (this.openaiConfig) {
      this.openaiConfig = { ...this.openaiConfig, ...config };
    } else {
      this.openaiConfig = {
        apiKey: config.apiKey || '',
        model: config.model || 'gpt-4',
        embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      };
    }
  }

  /**
   * Update Pinecone configuration
   */
  public updatePineconeConfig(config: Partial<PineconeConfig>): void {
    if (this.pineconeConfig) {
      this.pineconeConfig = { ...this.pineconeConfig, ...config };
    } else {
      this.pineconeConfig = {
        apiKey: config.apiKey || '',
        environment: config.environment || '',
        indexName: config.indexName || 'libby-library-search',
      };
    }
  }

  /**
   * Reset configuration
   */
  public resetConfig(): void {
    this.openaiConfig = null;
    this.pineconeConfig = null;
    this.loadConfig();
  }

  /**
   * Get environment variable value
   */
  public getEnvVar(key: string): string | undefined {
    return import.meta.env[key];
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return import.meta.env.PROD;
  }
}

export default ConfigService;
