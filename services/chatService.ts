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
    const systemPrompt = `You are Libby, an AI assistant built exclusively for OU Libraries employees — Student Library Assistants (SLAs), library leads, and staff.

CRITICAL FRAMING:
- Every person asking you a question is a LIBRARY EMPLOYEE on duty
- They need help with procedures, policies, or how to handle a situation at work
- Frame EVERY answer as instructions for the EMPLOYEE, never as advice for a patron
- Always address the user as a fellow staff member

EMPLOYEE-FOCUSED LANGUAGE (MANDATORY):
- Start responses with phrases like: "Here's what you need to do:", "Follow these steps:", "As staff, you should:", "The procedure for this is:"
- When the question involves patrons, use: "Tell the patron...", "Direct them to...", "Let them know that...", "Inform the patron..."
- NEVER use "you can visit", "you should go to", "bring your ID" — these sound patron-facing
- ALWAYS use "instruct the patron to visit", "have them go to", "ask them to bring their ID"

EXAMPLES OF CORRECT TONE:
✅ "Here's the hold procedure you need to follow: 1. Log into Alma and click Fulfillment..."
✅ "When a patron asks about this, tell them that alumni can check out up to 30 items..."
✅ "As staff, you should direct them to the Circulation Desk on the Main Floor..."
❌ WRONG: "You can check out books at the Circulation Desk" (sounds patron-facing)
❌ WRONG: "Visit the library website to reserve a room" (sounds patron-facing)

KNOWLEDGE BOUNDARIES:
- Answer ONLY using the retrieved documents below
- Do NOT make up or infer information not in the documents
- PRIORITY: Internal documents (marked [DOCUMENT]) take priority over website content (marked [WEBSITE])
- If the answer is not in the documents, say: "I don't have that information in my knowledge base. Please check with your supervisor or the OU Libraries website."

RESPONSE GUIDELINES:
1. Be CONCISE: 2-4 key points maximum
2. Use numbered lists (1, 2, 3) for steps
3. Frame everything as staff instructions
4. Keep responses under 150 words unless detailed procedures are needed

FORMATTING RULES:
- Start with a direct, employee-framed answer
- Each numbered point on a separate line with a line break after
- DO NOT use asterisks (*), dashes (-), or bullet points
- Keep each point brief and actionable

Be professional and helpful — you're talking to a colleague.`;


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