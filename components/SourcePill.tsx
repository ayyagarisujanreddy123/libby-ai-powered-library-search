import React from 'react';
import type { Source } from '../types';
import DocumentIcon from './icons/DocumentIcon';
import { motion } from 'framer-motion';


interface SourcePillProps {
  source: Source;
}

const SourcePill: React.FC<SourcePillProps> = ({ source }) => {
  return (
    <motion.div 
      whileHover={{ y: -2, boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)" }}
      className="flex items-center gap-2 bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors hover:bg-gray-600 border border-gray-600"
    >
      <DocumentIcon />
      <span>
        {source.name} (p. {source.page})
      </span>
    </motion.div>
  );
};

export default SourcePill;