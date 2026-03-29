import React from 'react';
import type { Source } from '../types';
import DocumentIcon from './icons/DocumentIcon';
import { motion } from 'framer-motion';

interface SourcePillProps {
  source: Source;
}

const SourcePill: React.FC<SourcePillProps> = ({ source }) => {
  const content = (
    <>
      <DocumentIcon />
      <span>
        {source.name}
        {source.page ? ` (p. ${source.page})` : ''}
      </span>
      {source.url && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 opacity-50">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </>
  );

  const className =
    'flex items-center gap-2 bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-gray-600 border border-gray-600';

  if (source.url) {
    return (
      <motion.a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ y: -2, boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)' }}
        className={className + ' cursor-pointer'}
        aria-label={`Open source: ${source.name}`}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)' }}
      className={className}
    >
      {content}
    </motion.div>
  );
};

export default SourcePill;
