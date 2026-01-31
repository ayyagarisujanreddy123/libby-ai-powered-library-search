import type { Message, Source } from '../types';
import { UserType } from '../types';
import RAGService from './ragService';
import ConfigService from './configService';

let ragService: RAGService | null = null;
let isInitializing = false;

// Lazily initialize the RAG service on first use
const getRAGService = async (): Promise<RAGService> => {
  if (!ragService && !isInitializing) {
    isInitializing = true;
    try {
      const configService = ConfigService.getInstance();
      const openaiConfig = configService.getOpenAIConfig();
      const pineconeConfig = configService.getPineconeConfig();
      
      if (!openaiConfig || !openaiConfig.apiKey) {
        throw new Error("OpenAI API key is not configured. Please check your environment variables (VITE_OPENAI_API_KEY).");
      }
      
      if (!pineconeConfig || !pineconeConfig.apiKey) {
        throw new Error("Pinecone API key is not configured. Please check your environment variables (VITE_PINECONE_API_KEY).");
      }
      
      ragService = new RAGService(openaiConfig, pineconeConfig);
      await ragService.initialize();
      console.log('RAG Service initialized with Pinecone');
    } catch (error) {
      isInitializing = false;
      console.error('Failed to initialize RAG service:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  }
  
  if (!ragService) {
    throw new Error("RAG service is still initializing. Please try again.");
  }
  
  return ragService;
};


export const sendMessageToBot = async (message: string): Promise<Message> => {
  console.log('Processing message with Pinecone RAG:', message);

  try {
    // Get the RAG service (initializes Pinecone if needed)
    const rag = await getRAGService();
    
    // Use RAG service to generate response with Pinecone vector search
    const systemPrompt = `You are Libby, a helpful AI assistant for library staff. 

Your task is to provide concise, well-organized answers using information from library documents.

RESPONSE GUIDELINES:
1. Be CONCISE: Answer directly and briefly (2-4 key points maximum)
2. Be ORGANIZED: Use numbered lists (1, 2, 3) when listing procedures or multiple points - NEVER use asterisks (*) or bullet points
3. Be FOCUSED: Only include the most important and relevant information
4. Be CLEAR: Use simple, direct language
5. Answer the question first, then provide essential details if needed
6. Keep responses under 150 words unless the question requires detailed procedures
7. If multiple topics are covered, organize them with clear headings or sections

FORMATTING RULES:
- Start with a direct answer to the question
- Use numbered lists (1, 2, 3) for procedures or multiple points
- CRITICAL: Each numbered point MUST be on a separate line. Put a line break after each point.
- Format example:
  1. First point here (on its own line)
  
  2. Second point here (on its own line)
  
  3. Third point here (on its own line)
- DO NOT use asterisks (*), dashes (-), or bullet points
- Keep each point brief and actionable
- Use clear headings for different sections if needed
- End with source citations if needed

Be friendly but professional. Get to the point quickly.`;
    
    const ragResponse = await rag.generateResponse(message, {
      topK: 5, // Reduced to focus on most relevant documents
      systemPrompt: systemPrompt,
      temperature: 0.3, // Slightly higher for more natural, concise language
      maxTokens: 500 // Reduced significantly for shorter responses
    });

    return {
      id: `bot-${Date.now()}`,
      text: ragResponse.answer,
      user: UserType.BOT,
      sources: ragResponse.sources,
    };
  } catch (error) {
    console.error("Error in sendMessageToBot:", error);
    let errorMessage = 'Sorry, I encountered an issue while processing your request. Please try again.';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Provide more user-friendly error messages
      if (errorMessage.includes('API key')) {
        errorMessage = 'API key is not configured. Please check your environment variables.';
      } else if (errorMessage.includes('Pinecone')) {
        errorMessage = 'Pinecone vector database is not configured or not accessible. Please check your Pinecone configuration.';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (errorMessage.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else if (errorMessage.includes('index') || errorMessage.includes('Index')) {
        errorMessage = 'Pinecone index not found or not ready. Please ensure your Pinecone index exists and is configured correctly.';
      }
    }
    
    return {
      id: `error-${Date.now()}`,
      text: errorMessage,
      user: UserType.BOT,
      sources: [],
      isError: true,
    };
  }
};