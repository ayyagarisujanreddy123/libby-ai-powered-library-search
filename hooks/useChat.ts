import { useState, useCallback, useEffect } from 'react';
import type { Message } from '../types';
import { UserType } from '../types';
import { sendMessageToBot } from '../services/chatService';

const initialMessage: Message = {
  id: 'init-0',
  text: "Hello! I'm Libby, your AI assistant for library procedures. How can I help you find information in our internal documents today?",
  user: UserType.BOT,
};

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [showStarterPrompts, setShowStarterPrompts] = useState(true);

  const clearChat = () => {
    setMessages([initialMessage]);
    setShowStarterPrompts(true);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (showStarterPrompts) {
      setShowStarterPrompts(false);
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      user: UserType.USER,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const botResponse = await sendMessageToBot(text);

      // Handle error responses from the service gracefully and display them immediately
      if (botResponse.isError) {
        setMessages((prev) => [...prev, botResponse]);
        return;
      }

      const botMessagePlaceholder: Message = {
        ...botResponse,
        id: `bot-${Date.now()}`,
        text: '', 
        sources: [],
        isStreaming: true,
      };
      setMessages((prev) => [...prev, botMessagePlaceholder]);

      // Simulate streaming effect
      let streamedText = '';
      const fullText = botResponse.text;
      const interval = setInterval(() => {
        try {
          streamedText = fullText.slice(0, streamedText.length + 1);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessagePlaceholder.id ? { ...msg, text: streamedText } : msg
            )
          );

          if (streamedText.length === fullText.length) {
            clearInterval(interval);
            // Add sources after text is fully streamed and stop streaming indicator
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessagePlaceholder.id ? { ...msg, sources: botResponse.sources, isStreaming: false } : msg
              )
            );
          }
        } catch (e) {
          console.error("Error during response streaming simulation:", e);
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessagePlaceholder.id
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
      }, 20);

    } catch (error) {
      console.error('Failed to get response from bot:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Oops! Something went wrong on my end. Please try again in a moment.',
        user: UserType.BOT,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [showStarterPrompts]);

  return { messages, isLoading, sendMessage, showStarterPrompts, clearChat };
};