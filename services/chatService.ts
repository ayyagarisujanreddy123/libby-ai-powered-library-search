import { GoogleGenAI, Type } from '@google/genai';
import type { Message, Source } from '../types';
import { UserType } from '../types';

let ai: GoogleGenAI;

// Lazily initialize the AI client on first use to make app loading more robust.
const getAiClient = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not configured. Please check your environment variables.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

const model = 'gemini-2.5-flash';

// This simulates our knowledge base for Retrieval-Augmented Generation (RAG)
const knowledgeBase: { [key: string]: { text: string; sources: Source[] } } = {
  'lost book': {
    text: "From Library_SOP_v2.1.pdf, Page 14: If a patron reports a lost book, first, check the system to confirm its status. If confirmed lost, inform the patron about the replacement fee, which is the original cost of the book plus a $5 processing fee. The fee can be paid at the main circulation desk. Offer to help them find an alternative title if needed.",
    sources: [
      { name: 'Library_SOP_v2.1.pdf', page: 14 },
    ],
  },
  'fire alarm': {
    text: "From Emergency_Protocols.pdf, Page 3: In the event of a fire alarm, immediately direct all patrons and staff to the nearest emergency exit. Do not use elevators. The designated assembly point is the main park across the street. A head count must be performed by the senior librarian on duty once everyone has assembled.",
    sources: [{ name: 'Emergency_Protocols.pdf', page: 3 }],
  },
  'late fee': {
    text: 'From Circulation_Policies.docx, Page 5: Overdue items accrue a late fee of $0.25 per day, per item, with a maximum fee of $10.00 per item. Fees can be paid online through the member portal or in person at any circulation desk. Patrons with outstanding fees over $25 will have their borrowing privileges suspended until the balance is paid.',
    sources: [{ name: 'Circulation_Policies.docx', page: 5 }],
  },
   'computer use': {
    text: "From Public_Access_Guide.pdf, Page 2: Library members can use public computers for up to 2 hours per day by logging in with their library card number and PIN. Guest passes for non-members are available at the information desk and are valid for one 60-minute session. All users must agree to the library's acceptable use policy before their session begins.",
    sources: [{ name: 'Public_Access_Guide.pdf', page: 2 }]
  }
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "The helpful, conversational answer to the user's question, synthesized from the provided context.",
    },
    sources: {
      type: Type.ARRAY,
      description: "An array of source documents and page numbers that were used to formulate the answer. This must be extracted from the provided context.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          page: { type: Type.INTEGER },
        },
        required: ['name', 'page'],
      },
    },
  },
  required: ['text', 'sources'],
};

export const sendMessageToBot = async (message: string): Promise<Message> => {
  console.log('Processing message with Gemini RAG:', message);

  // 1. Retrieval: Find relevant context from our knowledge base.
  const lowerCaseMessage = message.toLowerCase();
  let context = '';

  for (const keyword in knowledgeBase) {
    if (lowerCaseMessage.includes(keyword)) {
      context += knowledgeBase[keyword].text + '\n\n';
    }
  }

  try {
    const aiClient = getAiClient(); // Get the initialized client

    if (context) {
      // 2a. Generation (with context)
      const prompt = `You are Libby, a helpful AI assistant for library staff. Your task is to answer employee questions based ONLY on the provided context from internal library documents. Be friendly and concise. If the answer is not in the context, say so.

Context from documents:
---
${context}
---

User question: "${message}"

Based on the context, please provide a direct answer to the user's question and list the exact sources you used from the context.`;

      const response = await aiClient.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const jsonText = response.text.trim();
      const botResponse = JSON.parse(jsonText);
      
      return {
        id: `bot-${Date.now()}`,
        text: botResponse.text,
        user: UserType.BOT,
        sources: botResponse.sources,
      };
    } else {
      // 2b. Generation (no context)
      const prompt = `You are Libby, a helpful AI assistant for library staff. A user asked: "${message}". You could not find any relevant information in the internal library documents. Politely inform the user that you couldn't find specific information on their topic and suggest they could rephrase their question.`;

      const response = await aiClient.models.generateContent({
        model,
        contents: prompt,
      });

      return {
        id: `bot-${Date.now()}`,
        text: response.text,
        user: UserType.BOT,
        sources: [],
      };
    }
  } catch (error) {
    console.error("Error in sendMessageToBot:", error);
    const errorMessage = error instanceof Error ? error.message : 'Sorry, I encountered an issue while processing your request. Please try again.';
    return {
      id: `error-${Date.now()}`,
      text: errorMessage,
      user: UserType.BOT,
      sources: [],
      isError: true,
    };
  }
};