import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message } from '../types';
import { UserType } from '../types';
import { sendMessageToBot } from '../services/chatService';

const STORAGE_KEY = 'libby-chat-history';

const initialMessage: Message = {
  id: 'init-0',
  text: "Hello! I'm Libby, your AI assistant for library procedures. How can I help you find information in our internal documents today?",
  user: UserType.BOT,
  timestamp: Date.now(),
};

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Message[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Corrupted storage — start fresh
  }
  return [initialMessage];
}

function saveMessages(messages: Message[]) {
  try {
    // Only persist completed messages (not streaming)
    const toSave = messages.filter((m) => !m.isStreaming);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive showStarterPrompts from message state
  const showStarterPrompts = messages.length <= 1 && messages[0]?.id === 'init-0';

  // Persist messages when they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  const clearChat = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    const freshMessage = { ...initialMessage, timestamp: Date.now() };
    setMessages([freshMessage]);
    setIsLoading(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      user: UserType.USER,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const botResponse = await sendMessageToBot(text);

      // Handle error responses immediately (no streaming)
      if (botResponse.isError) {
        setMessages((prev) => [
          ...prev,
          { ...botResponse, timestamp: Date.now() },
        ]);
        return;
      }

      const placeholderId = `bot-${Date.now()}`;
      const botMessagePlaceholder: Message = {
        ...botResponse,
        id: placeholderId,
        text: '',
        sources: [],
        isStreaming: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, botMessagePlaceholder]);

      // Streaming text effect
      let streamedLength = 0;
      const fullText = botResponse.text;

      streamIntervalRef.current = setInterval(() => {
        try {
          streamedLength += 1;
          const streamedText = fullText.slice(0, streamedLength);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId ? { ...msg, text: streamedText } : msg
            )
          );

          if (streamedLength >= fullText.length) {
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
            // Reveal sources and stop streaming indicator
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === placeholderId
                  ? { ...msg, sources: botResponse.sources, isStreaming: false }
                  : msg
              )
            );
          }
        } catch {
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? {
                    ...msg,
                    text: 'An error occurred while displaying the response. Please try again.',
                    isError: true,
                    isStreaming: false,
                  }
                : msg
            )
          );
        }
      }, 15);
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Oops! Something went wrong on my end. Please try again in a moment.',
        user: UserType.BOT,
        isError: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, isLoading, sendMessage, showStarterPrompts, clearChat };
};
