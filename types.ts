
export enum UserType {
  USER = 'user',
  BOT = 'bot',
}

export interface Source {
  name: string;
  page: number;
  url?: string;
  content?: string;
}

export interface Message {
  id: string;
  text: string;
  user: UserType;
  sources?: Source[];
  isStreaming?: boolean;
  isError?: boolean;
}

// OpenAI Types
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatCompletionMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Pinecone Types
export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
  host?: string; // Optional host URL for REST API fallback
}

export interface VectorMetadata {
  text: string;
  source: string;
  page?: number;
  url?: string;
  timestamp?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface VectorSearchRequest {
  vector: number[];
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

// RAG (Retrieval-Augmented Generation) Types
export interface RAGContext {
  query: string;
  relevantDocuments: VectorSearchResult[];
  maxTokens?: number;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  confidence: number;
}