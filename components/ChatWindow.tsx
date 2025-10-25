import React, { useRef, useEffect } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { AnimatePresence, motion } from 'framer-motion';
import type { Message as MessageType } from '../types';

interface ChatWindowProps {
  messages: MessageType[];
  isLoading: boolean;
  sendMessage: (message: string) => void;
  showStarterPrompts: boolean;
}

const starterPrompts = [
  "What's the procedure for a fire alarm?",
  "How do I handle a lost book report?",
  "Tell me about the computer use policy.",
];

const StarterPrompts: React.FC<{ onSend: (prompt: string) => void }> = ({ onSend }) => (
  <div className="flex flex-col items-center gap-3 mb-4 px-6">
    <p className="text-sm text-gray-400">Or try one of these prompts:</p>
    <div className="flex flex-wrap justify-center gap-2">
      {starterPrompts.map((prompt, i) => (
        <motion.button
          key={i}
          onClick={() => onSend(prompt)}
          className="bg-gray-800 text-gray-200 text-sm px-4 py-2 rounded-full hover:bg-gray-700 transition-colors border border-gray-700"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.1 }}
          whileHover={{ y: -2 }}
        >
          {prompt}
        </motion.button>
      ))}
    </div>
  </div>
);


const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, sendMessage, showStarterPrompts }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, messages[messages.length-1]?.text]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
         {showStarterPrompts && !isLoading && <StarterPrompts onSend={sendMessage} />}
      </div>
      <div className="p-4 border-t border-gray-700">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default ChatWindow;