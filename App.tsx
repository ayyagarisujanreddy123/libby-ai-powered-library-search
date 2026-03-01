import React, { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { Search, Book, FileText, Users, HelpCircle, Sparkles, BookOpen, Clock, TrendingUp, Send, Bot, User } from 'lucide-react';
import { useChat } from './hooks/useChat';

console.log('App.tsx: Starting to load...');

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App.tsx: Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: '20px', fontFamily: 'monospace', background: '#dc2626', borderRadius: '8px', margin: '20px' }}>
          <h1>Error in App Component</h1>
          <pre style={{ background: '#1f1f1f', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <pre style={{ background: '#1f1f1f', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
            {this.state.error?.stack || ''}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LibbyChatbotInner() {
  console.log('App.tsx: LibbyChatbot component rendering...');
  const [isInitialState, setIsInitialState] = useState(true);
  const [books, setBooks] = useState([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, showStarterPrompts, clearChat } = useChat();

  // Memoize particle positions so they don't recalculate on re-render
  const particles = useMemo(() =>
    [...Array(30)].map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 5 + Math.random() * 10,
      delay: Math.random() * 5,
    })), []
  );

  // Generate flying books
  useEffect(() => {
    const newBooks = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
      duration: 15 + Math.random() * 20,
      delay: Math.random() * 5,
    }));
    setBooks(newBooks);
  }, []);

  const starterPrompts = [
    { icon: Book, label: 'Book Checkout Procedures', query: 'How do I check out books to students?' },
    { icon: FileText, label: 'Overdue Items Policy', query: 'What is the procedure for overdue items?' },
    { icon: Users, label: 'Student Library Access', query: 'How do students get library access?' },
    { icon: HelpCircle, label: 'Lost Items Protocol', query: 'What should I do about lost library materials?' }
  ];

  const handleChatStart = (query: string) => {
    setIsInitialState(false);
    sendMessage(query);
  };

  const handleNewChat = () => {
    setIsInitialState(true);
    clearChat();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Flying 3D Books - White */}
      {books.map((book) => (
        <div
          key={book.id}
          className="absolute pointer-events-none"
          style={{
            left: `${book.x}%`,
            top: `${book.y}%`,
            animation: `float-${book.id} ${book.duration}s ease-in-out infinite`,
            animationDelay: `${book.delay}s`,
            transform: `scale(${book.scale})`,
            opacity: 0.15,
            zIndex: 1
          }}
        >
          <div
            className="w-16 h-20 bg-white rounded-lg shadow-2xl relative"
            style={{
              transform: `rotateY(${book.rotation}deg) rotateX(${book.rotation * 0.5}deg)`,
              animation: `spin3d ${book.duration * 0.5}s linear infinite`,
              boxShadow: '0 20px 60px rgba(255,255,255,0.1)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-gray-300/80 rounded-lg"></div>
            <div className="absolute left-1 top-2 bottom-2 w-1 bg-gray-400/40 rounded"></div>
            <BookOpen className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-gray-800/60" />
          </div>
        </div>
      ))}

      {/* Animated particles - White */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute w-2 h-2 bg-white rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `particle ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`
            }}
          ></div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-4xl h-full flex flex-col" style={{ perspective: '1500px' }}>

        {/* Header with Logo */}
        <div className="text-center mb-6 animate-fadeIn">
          <div className="flex items-center justify-center mb-4">
            {/* JARVIS-style Interactive Logo - Smaller */}
            <div className="relative w-32 h-32 transform hover:scale-110 transition-all duration-500 cursor-pointer group">

              {/* Outer rotating ring 1 */}
              <div className="absolute inset-0 rounded-full border-2 border-white/40" style={{ animation: 'rotate 8s linear infinite' }}>
                <div className="absolute top-0 left-1/2 w-1.5 h-1.5 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute top-1/4 right-0 w-1.5 h-1.5 bg-white/70 rounded-full transform translate-x-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute bottom-1/4 left-0 w-1.5 h-1.5 bg-white/70 rounded-full transform -translate-x-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 bg-white/60 rounded-full transform translate-y-1/2 shadow-lg shadow-white/50"></div>
              </div>

              {/* Outer rotating ring 2 */}
              <div className="absolute inset-2 rounded-full border-2 border-white/50" style={{ animation: 'rotateReverse 6s linear infinite' }}>
                <div className="absolute top-1/3 left-0 w-1.5 h-1.5 bg-white/80 rounded-full transform -translate-x-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute bottom-0 right-1/3 w-1.5 h-1.5 bg-white/80 rounded-full transform translate-y-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute top-0 right-1/4 w-1.5 h-1.5 bg-white/70 rounded-full transform -translate-y-1/2 shadow-lg shadow-white/50"></div>
                <div className="absolute bottom-1/3 right-0 w-1.5 h-1.5 bg-white/70 rounded-full transform translate-x-1/2 shadow-lg shadow-white/50"></div>
              </div>

              {/* Technical arc segments */}
              <svg className="absolute inset-4" style={{ animation: 'rotate 10s linear infinite' }}>
                <circle cx="48" cy="48" r="45" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.4" />
                <circle cx="48" cy="48" r="42" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 8" opacity="0.5" />
              </svg>

              {/* Middle ring with segments */}
              <div className="absolute inset-6 rounded-full border-2 border-white/60" style={{ animation: 'rotate 12s linear infinite' }}>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-3 bg-white/70 rounded-full shadow-lg shadow-white/30"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-32px)`,
                      animation: `segmentPulse ${1 + Math.random()}s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  ></div>
                ))}
              </div>

              {/* Inner core ring */}
              <div className="absolute inset-10 rounded-full border-3 border-white/70 bg-black/80 backdrop-blur-xl shadow-2xl group-hover:border-white/90 transition-all duration-500">
                {/* Pulsing core glow */}
                <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse" style={{ animationDuration: '2s' }}></div>

                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg tracking-[0.2em] group-hover:tracking-[0.3em] transition-all duration-500">LIBBY</span>
                </div>

                {/* Orbiting data points */}
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-white rounded-full shadow-lg shadow-white/50"
                    style={{
                      top: '50%',
                      left: '50%',
                      animation: `orbit ${2 + (i % 3)}s linear infinite`,
                      animationDelay: `${i * 0.15}s`,
                      opacity: 0.7
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-lg text-gray-300 font-medium">AI-Powered Library Assistant</p>
          <p className="text-xs text-gray-400 mt-1">Chat with Libby about library procedures and policies</p>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
          style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.9), 0 0 80px rgba(255,255,255,0.05)' }}>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isInitialState ? (
              /* Initial State - Welcome and Starter Prompts */
              <div className="text-center py-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Welcome to Libby!</h2>
                  <p className="text-gray-300 mb-6">I'm here to help you with library procedures, policies, and guidelines. How can I assist you today?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {starterPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleChatStart(prompt.query)}
                      className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/20 hover:border-white/30 transition-all duration-300 text-left group"
                      style={{
                        animation: 'fadeIn 0.5s ease-out',
                        animationDelay: `${i * 0.1}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <prompt.icon className="w-5 h-5 text-white group-hover:text-blue-400 transition-colors" />
                        <span className="text-white font-medium">{prompt.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <>
                {messages.map((message, idx) => (
                  <div
                    key={message.id}
                    className={`flex ${message.user === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                    style={{
                      animationDelay: `${idx * 0.1}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <div className={`flex items-start gap-3 max-w-[80%] ${message.user === 'user' ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.user === 'user' ? 'bg-blue-600' : 'bg-white/20'
                        }`}>
                        {message.user === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={`px-4 py-3 rounded-2xl ${message.user === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : message.isError
                          ? 'bg-red-500/20 text-red-200 border border-red-500/30 rounded-bl-md'
                          : 'bg-white/10 text-white border border-white/20 rounded-bl-md'
                        }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {message.text}
                          {message.isStreaming && (
                            <span className="inline-block w-0.5 h-4 bg-white animate-pulse ml-1 align-bottom"></span>
                          )}
                        </p>

                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.sources.map((source, sourceIdx) => (
                              <div
                                key={sourceIdx}
                                className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1 text-xs text-gray-300"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{source.name} (p. {source.page})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="flex justify-start animate-fadeIn">
                    <div className="flex items-start gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 rounded-bl-md">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Ask about library procedures..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-white/40 transition-colors"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleChatStart(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const input = document.querySelector('input');
                  if (input?.value.trim()) {
                    handleChatStart(input.value);
                    input.value = '';
                  }
                }}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                <Send className="w-5 h-5 text-white" />
              </button>
              {!isInitialState && (
                <button
                  onClick={handleNewChat}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors"
                  title="New Chat"
                >
                  <span className="text-white text-sm font-medium">New</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10 pointer-events-none">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl rounded-full border border-white/10">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
          <span className="text-gray-300 text-sm font-medium">RAG Vector Database Connected</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes particle {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }

        @keyframes spin3d {
          0% {
            transform: rotateY(0deg) rotateX(0deg) rotateZ(0deg);
          }
          100% {
            transform: rotateY(360deg) rotateX(360deg) rotateZ(360deg);
          }
        }

        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rotateReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes segmentPulse {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(-55px) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(-55px) scale(1.2);
          }
        }

        @keyframes scan {
          0% {
            transform: translateY(-100%) rotate(0deg);
          }
          100% {
            transform: translateY(100%) rotate(360deg);
          }
        }

        @keyframes orbit {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) translateX(30px);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) translateX(30px);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-10px) translateX(5px);
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 2rem;
            opacity: 0.4;
          }
        }

        ${books.map((book, i) => `
          @keyframes float-${i} {
            0%, 100% {
              transform: translate(0, 0) scale(${book.scale});
            }
            25% {
              transform: translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(${book.scale * 1.2});
            }
            50% {
              transform: translate(${(Math.random() - 0.5) * 300}px, ${(Math.random() - 0.5) * 300}px) scale(${book.scale * 0.8});
            }
            75% {
              transform: translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(${book.scale * 1.1});
            }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}

// Export wrapped in error boundary
export default function LibbyChatbot() {
  console.log('App.tsx: LibbyChatbot wrapper rendering...');
  return (
    <ErrorBoundary>
      <LibbyChatbotInner />
    </ErrorBoundary>
  );
}
