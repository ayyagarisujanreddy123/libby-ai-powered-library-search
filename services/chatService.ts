import type { Message, Source } from '../types';
import { UserType } from '../types';

export const sendMessageToBot = async (message: string): Promise<Message> => {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `Request failed: ${res.status}`);
    }

    const sources: Source[] = Array.isArray(data.sources) ? data.sources : [];

    return {
      id: `bot-${Date.now()}`,
      text: data.answer || '',
      user: UserType.BOT,
      sources,
    };
  } catch (error) {
    console.error('Error in sendMessageToBot:', error);
    let errorMessage = 'Sorry, I encountered an issue while processing your request. Please try again.';

    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (msg.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else {
        errorMessage = msg;
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
