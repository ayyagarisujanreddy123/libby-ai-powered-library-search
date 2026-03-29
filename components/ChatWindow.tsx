import React, { useRef, useEffect, useState, useCallback } from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import { AnimatePresence, motion } from 'framer-motion';
import type { Message as MessageType } from '../types';

interface ChatWindowProps {
  messages: MessageType[];
  isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // Auto-scroll when new messages arrive or text streams in
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, messages[messages.length - 1]?.text, scrollToBottom]);

  // Track scroll position to show/hide the scroll-to-bottom button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-6 space-y-6"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
      </div>

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white shadow-lg flex items-center justify-center transition-colors z-10 border border-gray-600"
            aria-label="Scroll to latest message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWindow;
