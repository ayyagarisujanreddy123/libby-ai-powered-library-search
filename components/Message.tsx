import React, { useState, useMemo } from 'react';
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

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${time}`;
}

/**
 * Lightweight markdown-to-JSX renderer.
 * Handles: **bold**, numbered lists, `inline code`, and line breaks.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Numbered list item: "1. text" or "1) text"
    const listMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (listMatch) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-blue-400 font-semibold flex-shrink-0 min-w-[1.5rem]">{listMatch[1]}.</span>
          <span>{renderInline(listMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular text line
    elements.push(
      <div key={i}>{renderInline(line)}</div>
    );
  }

  return elements;
}

/** Render inline formatting: **bold**, `code` */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {match[2]}
        </strong>
      );
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300">
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
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

  const renderedText = useMemo(() => {
    if (!isBot || isError || message.isStreaming) return null;
    return renderMarkdown(message.text);
  }, [isBot, isError, message.isStreaming, message.text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      layout
      className={`group flex items-start gap-4 ${isBot ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isBot ? 'bg-blue-500' : 'bg-slate-600'
        }`}
      >
        {isBot ? <BotIcon /> : <UserIcon />}
      </div>

      {/* Bubble + meta */}
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
          <div className="leading-relaxed min-h-[1.75rem]">
            {renderedText ? (
              renderedText
            ) : (
              <p className="whitespace-pre-wrap">
                {message.text}
                {message.isStreaming && (
                  <span className="inline-block w-0.5 h-5 bg-gray-100 animate-pulse ml-1 align-bottom" />
                )}
              </p>
            )}
          </div>
        </div>

        {/* Copy button */}
        {isBot && message.text && !message.isStreaming && !isError && (
          <button
            onClick={handleCopy}
            className="absolute -top-2 -right-2 md:-right-10 p-1.5 rounded-full bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={isCopied ? 'Copied' : 'Copy message'}
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className={`mt-3 flex flex-wrap gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}>
            {message.sources.map((source, index) => (
              <SourcePill key={index} source={source} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <p className={`text-[11px] text-gray-500 mt-1.5 ${isBot ? 'text-left' : 'text-right'}`}>
            {formatTimestamp(message.timestamp)}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default Message;
