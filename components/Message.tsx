import React, { useState } from 'react';
import type { Message } from '../types';
import { UserType } from '../types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';
import SourcePill from './SourcePill';
import { motion } from 'framer-motion';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';

interface MessageProps {
  message: Message;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const [isCopied, setIsCopied] = useState(false);
  const isBot = message.user === UserType.BOT;
  const isError = message.isError;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      layout
      className={`group flex items-start gap-4 ${isBot ? '' : 'flex-row-reverse'}`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isBot ? 'bg-blue-500' : 'bg-slate-500 dark:bg-slate-600'}`}>
        {isBot ? <BotIcon /> : <UserIcon />}
      </div>
      <div className={`relative max-w-2xl ${isBot ? 'text-left' : 'text-right'}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isBot
              ? isError
                ? 'bg-red-500/20 text-red-200 border border-red-500/30 rounded-tl-none'
                : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700'
              : 'bg-blue-600 text-white rounded-tr-none'
          }`}
        >
          <p className="leading-relaxed min-h-[1.75rem] whitespace-pre-wrap">
            {message.text}
            {message.isStreaming && <span className="inline-block w-0.5 h-5 bg-gray-100 animate-pulse ml-1 align-bottom"></span>}
          </p>
        </div>
        
        {isBot && message.text && !message.isStreaming && !isError && (
            <button 
              onClick={handleCopy}
              className="absolute -top-2 -right-2 md:-right-10 p-1 rounded-full bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Copy message"
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}

        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 flex flex-wrap gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}>
            {message.sources.map((source, index) => (
              <SourcePill key={index} source={source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Message;