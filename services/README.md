# Libby AI Services

This directory contains the AI services for the Libby library assistant, including OpenAI integration and Pinecone vector database functionality.

## Services Overview

### 1. ConfigService
Manages environment variables and configuration for all AI services.

### 2. OpenAIService
Handles OpenAI API interactions including:
- Text embeddings generation
- Chat completions
- Streaming responses
- RAG (Retrieval-Augmented Generation) responses

### 3. PineconeService
Manages Pinecone vector database operations:
- Vector storage and retrieval
- Similarity search
- Index management
- Metadata handling

### 4. RAGService
Combines OpenAI and Pinecone for intelligent document search and response generation.

## Setup Instructions

### 1. Environment Variables
Create a `.env` file in the project root with the following variables:

```env
# OpenAI Configuration
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Pinecone Configuration
VITE_PINECONE_API_KEY=your_pinecone_api_key_here
VITE_PINECONE_ENVIRONMENT=your_pinecone_environment_here
VITE_PINECONE_INDEX_NAME=libby-library-search

# Optional: Custom model configurations
VITE_OPENAI_MODEL=gpt-4
VITE_EMBEDDING_MODEL=text-embedding-3-small
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Get API Keys

#### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env` file

#### Pinecone API Key
1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Sign up or log in
3. Create a new project
4. Get your API key and environment from the dashboard
5. Add them to your `.env` file

## Usage Examples

### Basic RAG Service Usage

```typescript
import RAGService from './services/ragService';
import ConfigService from './services/configService';

// Initialize services
const configService = ConfigService.getInstance();
const openaiConfig = configService.getOpenAIConfig();
const pineconeConfig = configService.getPineconeConfig();

if (openaiConfig && pineconeConfig) {
  const ragService = new RAGService(openaiConfig, pineconeConfig);
  
  // Initialize the service
  await ragService.initialize();
  
  // Add documents to the vector database
  await ragService.addDocuments([
    {
      id: 'doc1',
      text: 'Library checkout procedures...',
      metadata: {
        source: 'Library Manual',
        page: 1,
        url: 'https://example.com/manual'
      }
    }
  ]);
  
  // Generate a response
  const response = await ragService.generateResponse(
    'How do I check out books?'
  );
  
  console.log(response.answer);
  console.log(response.sources);
}
```

### Streaming Response

```typescript
// Generate streaming response
for await (const chunk of ragService.generateStreamingResponse(
  'What are the library hours?'
)) {
  switch (chunk.type) {
    case 'context':
      console.log('Found documents:', chunk.data.documentsFound);
      break;
    case 'answer':
      console.log('Answer chunk:', chunk.data);
      break;
    case 'sources':
      console.log('Sources:', chunk.data);
      break;
    case 'done':
      console.log('Final response:', chunk.data);
      break;
  }
}
```

### Direct OpenAI Usage

```typescript
import OpenAIService from './services/openaiService';

const openaiService = new OpenAIService(openaiConfig);

// Generate embedding
const embedding = await openaiService.generateEmbedding('Library procedures');

// Generate chat completion
const response = await openaiService.generateChatCompletion([
  { role: 'user', content: 'How do I check out books?' }
]);
```

### Direct Pinecone Usage

```typescript
import PineconeService from './services/pineconeService';

const pineconeService = new PineconeService(pineconeConfig);
await pineconeService.initialize();

// Search for similar vectors
const results = await pineconeService.searchVectors({
  vector: embedding,
  topK: 5
});
```

## Configuration

### Model Configuration
You can customize the models used by setting environment variables:

- `VITE_OPENAI_MODEL`: Chat completion model (default: gpt-4)
- `VITE_EMBEDDING_MODEL`: Embedding model (default: text-embedding-3-small)

### Pinecone Configuration
- `VITE_PINECONE_INDEX_NAME`: Name of your Pinecone index (default: libby-library-search)

## Error Handling

All services include comprehensive error handling. Common errors include:

- Missing API keys
- Invalid API keys
- Network connectivity issues
- Index not found
- Rate limiting

## Best Practices

1. **Environment Variables**: Never commit API keys to version control
2. **Error Handling**: Always wrap service calls in try-catch blocks
3. **Rate Limiting**: Be mindful of API rate limits
4. **Vector Dimensions**: Ensure embedding dimensions match your Pinecone index
5. **Metadata**: Use meaningful metadata for better search results

## Troubleshooting

### Common Issues

1. **"API key not found"**: Check your `.env` file and ensure variables start with `VITE_`
2. **"Index not found"**: Create the index in Pinecone console or use `createIndex()` method
3. **"Embedding dimension mismatch"**: Ensure your Pinecone index dimension matches the embedding model
4. **CORS errors**: Use a backend proxy for production deployments

### Debug Mode

Enable debug logging by setting:
```env
VITE_DEBUG=true
```

## Security Notes

- API keys are exposed to the client in this setup
- For production, implement a backend proxy to keep API keys secure
- Consider implementing rate limiting and usage monitoring
- Regularly rotate API keys

## Support

For issues or questions:
1. Check the console for error messages
2. Verify your API keys and configuration
3. Ensure your Pinecone index is properly set up
4. Check network connectivity
