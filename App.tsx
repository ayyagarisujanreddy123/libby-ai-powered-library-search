import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { Book, FileText, Users, HelpCircle, BookOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AboutModal from './components/AboutModal';
import NewChatIcon from './components/icons/NewChatIcon';
import InfoIcon from './components/icons/InfoIcon';

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-lg text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Libby encountered an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Background animation data (generated once, stable across renders)
// ---------------------------------------------------------------------------
interface BookData {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  duration: number;
  delay: number;
  dx1: number; dy1: number;
  dx2: number; dy2: number;
  dx3: number; dy3: number;
}

function generateBooks(): BookData[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 5,
    dx1: (Math.random() - 0.5) * 200,
    dy1: (Math.random() - 0.5) * 200,
    dx2: (Math.random() - 0.5) * 300,
    dy2: (Math.random() - 0.5) * 300,
    dx3: (Math.random() - 0.5) * 200,
    dy3: (Math.random() - 0.5) * 200,
  }));
}

interface ParticleData {
  id: number;
  left: number;
  top: number;
  duration: number;
  delay: number;
}

function generateParticles(): ParticleData[] {
  return [...Array(20)].map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 5 + Math.random() * 10,
    delay: Math.random() * 5,
  }));
}

// ---------------------------------------------------------------------------
// JARVIS-style Logo
// ---------------------------------------------------------------------------
const JarvisLogo: React.FC = () => (
  <div className="relative w-28 h-28 md:w-32 md:h-32 transform hover:scale-110 transition-all duration-500 cursor-pointer group">
    {/* Outer rotating ring 1 */}
    <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-spin-slow">
      <div className="absolute top-0 left-1/2 w-1.5 h-1.5 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-white/50" />
      <div className="absolute top-1/4 right-0 w-1.5 h-1.5 bg-white/70 rounded-full transform translate-x-1/2 shadow-lg shadow-white/50" />
      <div className="absolute bottom-1/4 left-0 w-1.5 h-1.5 bg-white/70 rounded-full transform -translate-x-1/2 shadow-lg shadow-white/50" />
    </div>

    {/* Outer rotating ring 2 */}
    <div className="absolute inset-2 rounded-full border-2 border-white/50 animate-spin-reverse">
      <div className="absolute top-1/3 left-0 w-1.5 h-1.5 bg-white/80 rounded-full transform -translate-x-1/2 shadow-lg shadow-white/50" />
      <div className="absolute bottom-0 right-1/3 w-1.5 h-1.5 bg-white/80 rounded-full transform translate-y-1/2 shadow-lg shadow-white/50" />
    </div>

    {/* Dashed arcs */}
    <svg className="absolute inset-4 w-full h-full animate-spin-slow" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="45" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.4" />
      <circle cx="48" cy="48" r="42" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 8" opacity="0.5" />
    </svg>

    {/* Middle ring with tick marks */}
    <div className="absolute inset-6 rounded-full border-2 border-white/60 animate-spin-medium">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-3 bg-white/70 rounded-full"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-32px)`,
          }}
        />
      ))}
    </div>

    {/* Inner core */}
    <div className="absolute inset-10 rounded-full border-[3px] border-white/70 bg-black/80 backdrop-blur-xl shadow-2xl group-hover:border-white/90 transition-all duration-500">
      <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse" style={{ animationDuration: '2s' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-base md:text-lg tracking-[0.2em] group-hover:tracking-[0.3em] transition-all duration-500">
          LIBBY
        </span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Starter Prompts
// ---------------------------------------------------------------------------
const promptItems = [
  { icon: Book, label: 'Book Checkout Procedures', query: 'How do I check out books to students?' },
  { icon: FileText, label: 'Overdue Items Policy', query: 'What is the procedure for overdue items?' },
  { icon: Users, label: 'Student Library Access', query: 'How do students get library access?' },
  { icon: HelpCircle, label: 'Lost Items Protocol', query: 'What should I do about lost library materials?' },
];

const StarterPrompts: React.FC<{ onSend: (q: string) => void }> = ({ onSend }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
    <h2 className="text-2xl font-bold text-white mb-3">Welcome to Libby!</h2>
    <p className="text-gray-400 mb-8 text-center max-w-md">
      I'm here to help you with library procedures, policies, and guidelines. How can I assist you today?
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
      {promptItems.map((prompt, i) => (
        <motion.button
          key={i}
          onClick={() => onSend(prompt.query)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.08 }}
          whileHover={{ y: -2 }}
          className="p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 hover:border-gray-600 transition-all text-left group"
          aria-label={`Ask: ${prompt.query}`}
        >
          <div className="flex items-center gap-3">
            <prompt.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            <span className="text-gray-200 text-sm font-medium">{prompt.label}</span>
          </div>
        </motion.button>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function LibbyChatbotInner() {
  const { messages, isLoading, sendMessage, showStarterPrompts, clearChat } = useChat();
  const [showAbout, setShowAbout] = useState(false);

  // Generate background data once (stable across renders)
  const books = useMemo(generateBooks, []);
  const particles = useMemo(generateParticles, []);
  const bookKeyframes = useMemo(
    () =>
      books
        .map(
          (b) => `
      @keyframes float-${b.id} {
        0%, 100% { transform: translate(0, 0) scale(${b.scale}); }
        25%  { transform: translate(${b.dx1}px, ${b.dy1}px) scale(${b.scale * 1.2}); }
        50%  { transform: translate(${b.dx2}px, ${b.dy2}px) scale(${b.scale * 0.8}); }
        75%  { transform: translate(${b.dx3}px, ${b.dy3}px) scale(${b.scale * 1.1}); }
      }`
        )
        .join('\n'),
    [books]
  );

  return (
    <div className="h-screen bg-black flex flex-col items-center p-4 overflow-hidden relative">
      {/* Background: flying books */}
      {books.map((book) => (
        <div
          key={book.id}
          className="absolute pointer-events-none will-change-transform"
          style={{
            left: `${book.x}%`,
            top: `${book.y}%`,
            animation: `float-${book.id} ${book.duration}s ease-in-out infinite`,
            animationDelay: `${book.delay}s`,
            transform: `scale(${book.scale})`,
            opacity: 0.12,
            zIndex: 1,
          }}
        >
          <div
            className="w-16 h-20 bg-white rounded-lg relative"
            style={{
              transform: `rotateY(${book.rotation}deg) rotateX(${book.rotation * 0.5}deg)`,
              animation: `spin3d ${book.duration * 0.5}s linear infinite`,
              boxShadow: '0 20px 60px rgba(255,255,255,0.1)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-300/80 rounded-lg" />
            <div className="absolute left-1 top-2 bottom-2 w-1 bg-gray-400/40 rounded" />
            <BookOpen className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-gray-800/60" />
          </div>
        </div>
      ))}

      {/* Background: particles */}
      <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute w-2 h-2 bg-white rounded-full will-change-transform"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `particle ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col h-full">
        {/* Header */}
        <div className="text-center mb-4 flex-shrink-0">
          <div className="flex items-center justify-center mb-3">
            <JarvisLogo />
          </div>
          <p className="text-lg text-gray-300 font-medium">AI-Powered Library Assistant</p>
          <p className="text-xs text-gray-500 mt-0.5">Chat with Libby about library procedures and policies</p>
        </div>

        {/* Chat card */}
        <div
          className="flex-1 flex flex-col bg-gray-900/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-700/60 overflow-hidden min-h-0"
          style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 80px rgba(255,255,255,0.03)' }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/60 flex-shrink-0">
            <button
              onClick={() => setShowAbout(true)}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="About Libby"
            >
              <InfoIcon />
            </button>

            <span className="text-gray-500 text-xs select-none">Libby v1.0</span>

            {!showStarterPrompts ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors text-sm"
                aria-label="Start a new chat"
              >
                <NewChatIcon />
                <span className="hidden md:inline">New Chat</span>
              </motion.button>
            ) : (
              <div className="w-20" />
            )}
          </div>

          {/* Messages or starter prompts */}
          {showStarterPrompts ? (
            <StarterPrompts onSend={sendMessage} />
          ) : (
            <ChatWindow messages={messages} isLoading={isLoading} />
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-700/60 flex-shrink-0">
            <ChatInput onSend={sendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>

      {/* About modal */}
      <AnimatePresence>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      </AnimatePresence>

      {/* Scoped dynamic keyframes (memoized) */}
      <style>{bookKeyframes}</style>
    </div>
  );
}

export default function LibbyChatbot() {
  return (
    <ErrorBoundary>
      <LibbyChatbotInner />
    </ErrorBoundary>
  );
}
