import React from 'react';
import { motion } from 'framer-motion';
import CloseIcon from './icons/CloseIcon';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full relative text-gray-200 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full p-1 transition-colors"
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500 mb-4">About Libby</h2>
        <p className="text-gray-300 mb-2">
          Libby is an AI-powered internal chatbot designed to help library employees quickly find and follow standard operating procedures, emergency protocols, and internal policy documents.
        </p>
        <p className="text-gray-300">
          Using a Retrieval-Augmented Generation (RAG) framework, Libby provides answers sourced directly from internal library documentation, ensuring accuracy and reliability.
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AboutModal;