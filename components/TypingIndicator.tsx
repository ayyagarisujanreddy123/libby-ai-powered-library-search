import React from 'react';
import { motion } from 'framer-motion';
import BotIcon from './icons/BotIcon';

const TypingIndicator: React.FC = () => {
  const dotVariants = {
    initial: { y: 0 },
    animate: {
      y: -5,
      transition: {
        duration: 0.4,
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-4"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-500">
        <BotIcon />
      </div>
nu      <div className="px-4 py-3 rounded-2xl bg-gray-800 rounded-tl-none border border-gray-700">
        <div className="flex items-center justify-center space-x-1 h-6">
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            style={{ transitionDelay: '0s' }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            style={{ transitionDelay: '0.2s' }}
          />
          <motion.span
            className="w-2 h-2 bg-gray-400 rounded-full"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            style={{ transitionDelay: '0.4s' }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;