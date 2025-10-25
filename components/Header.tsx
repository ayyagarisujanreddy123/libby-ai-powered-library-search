import React from 'react';
import NewChatIcon from './icons/NewChatIcon';
import { SunIcon, MoonIcon } from './icons/ThemeIcons';
import InfoIcon from './icons/InfoIcon';

interface HeaderProps {
  onNewChat: () => void;
  theme: string;
  toggleTheme: () => void;
  onAboutClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewChat, theme, toggleTheme, onAboutClick }) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onAboutClick} className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="About Libby">
          <InfoIcon />
        </button>
        <span className="text-gray-300 text-sm">v40 • Latest</span>
      </div>

      <div className="text-center">
        <h1 className="text-lg font-semibold text-white">AI-Powered Library Assistant</h1>
      </div>
      
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Refresh">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
          Copy
          <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          Publish
        </button>
        <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Header;