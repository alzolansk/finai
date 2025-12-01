import React, { useRef, useEffect, useState } from 'react';
import { X, Sparkles, Brain, Cpu, Send, Mic, Wand2, Maximize2, Minimize2, ChevronRight } from 'lucide-react';
import { ChatMessage } from '../types';

interface ImmersiveChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onChatAction?: (message: ChatMessage, actionId: string) => void;
  chatActionLoadingId?: string | null;
}

// Helper to parse markdown bold
const formatMessageText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-emerald-600">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Typing effect component
const TypingText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 15 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {isComplete ? formatMessageText(text) : displayedText}
      {!isComplete && <span className="animate-cursor-blink text-emerald-500">|</span>}
    </span>
  );
};

const ImmersiveChat: React.FC<ImmersiveChatProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  onChatAction,
  chatActionLoadingId
}) => {
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Reset expanded state when chat closes
  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const quickActions = [
    { label: 'Resumo do mês', query: 'Me dê um resumo dos meus gastos este mês', icon: '📊' },
    { label: 'Onde economizar?', query: 'Onde posso economizar dinheiro?', icon: '💡' },
    { label: 'Maiores gastos', query: 'Quais foram meus maiores gastos?', icon: '📈' },
  ];

  return (
    <>
      {/* Backdrop - only when expanded */}
      {isExpanded && isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-900/10 transition-opacity duration-300"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Chat Panel */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 transform transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isExpanded ? 'w-full md:w-[600px]' : 'w-full md:w-[400px]'}`}
      >
        <div className="h-full flex flex-col bg-white/95 backdrop-blur-xl border-l border-zinc-200/50 shadow-2xl relative overflow-hidden">
          
          {/* Enhanced Background Effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-white to-blue-50/30" />
            
            {/* Animated floating orbs */}
            <div className="absolute top-20 -right-20 w-80 h-80 bg-gradient-to-br from-emerald-400/8 to-emerald-300/5 rounded-full blur-3xl animate-float-orb" />
            <div className="absolute bottom-40 -left-20 w-64 h-64 bg-gradient-to-br from-blue-400/8 to-blue-300/5 rounded-full blur-3xl animate-float-orb" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 right-10 w-48 h-48 bg-gradient-to-br from-purple-400/6 to-purple-300/4 rounded-full blur-2xl animate-float-orb" style={{ animationDelay: '4s' }} />
            
            {/* Floating financial symbols */}
            <div className="absolute top-32 left-8 text-emerald-200/30 text-4xl font-bold animate-float-particle">$</div>
            <div className="absolute top-48 right-12 text-blue-200/25 text-3xl font-bold animate-float-particle" style={{ animationDelay: '1s' }}>€</div>
            <div className="absolute bottom-64 left-16 text-purple-200/25 text-2xl font-bold animate-float-particle" style={{ animationDelay: '2s' }}>¥</div>
            <div className="absolute top-2/3 right-20 text-emerald-200/20 text-5xl font-bold animate-float-particle" style={{ animationDelay: '3s' }}>₿</div>
            <div className="absolute bottom-32 right-8 text-blue-200/30 text-3xl animate-float-particle" style={{ animationDelay: '1.5s' }}>💰</div>
            <div className="absolute top-1/3 left-12 text-emerald-200/25 text-2xl animate-float-particle" style={{ animationDelay: '2.5s' }}>📊</div>
            <div className="absolute bottom-48 left-24 text-purple-200/20 text-4xl animate-float-particle" style={{ animationDelay: '0.5s' }}>💳</div>
            
            {/* Animated lines/connections */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <line x1="10%" y1="20%" x2="90%" y2="30%" stroke="url(#lineGradient)" strokeWidth="1" className="animate-pulse" />
              <line x1="20%" y1="60%" x2="80%" y2="70%" stroke="url(#lineGradient)" strokeWidth="1" className="animate-pulse" style={{ animationDelay: '1s' }} />
              <line x1="30%" y1="40%" x2="70%" y2="80%" stroke="url(#lineGradient)" strokeWidth="1" className="animate-pulse" style={{ animationDelay: '2s' }} />
            </svg>
            
            {/* Subtle grid with animation */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: 'linear-gradient(rgba(16, 185, 129, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              animation: 'subtle-shift 20s ease-in-out infinite'
            }} />
            
            {/* Corner accents - tech style */}
            <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-emerald-200/30 rounded-tl-xl" />
            <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-blue-200/30 rounded-tr-xl" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-purple-200/30 rounded-bl-xl" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-emerald-200/30 rounded-br-xl" />
            
            {/* Animated scan line */}
            {isLoading && (
              <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent animate-scan-vertical" />
            )}
            
            {/* Floating data particles when processing */}
            {isLoading && (
              <>
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400/40 rounded-full animate-ping" />
                <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-blue-400/40 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
                <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-400/40 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 bg-emerald-400/40 rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />
              </>
            )}
          </div>

          {/* Header */}
          <div className="relative z-10 p-4 md:p-5 border-b border-zinc-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center border border-emerald-200/50 shadow-sm">
                  <Brain className="w-5 h-5 text-emerald-600" />
                </div>
                {/* Status indicator */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-800 text-base flex items-center gap-2">
                  FinAI
                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                    IA
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {isLoading ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                      Analisando...
                    </span>
                  ) : 'Assistente financeiro'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Expand/Collapse button */}
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600 hidden md:flex"
                title={isExpanded ? 'Recolher' : 'Expandir'}
              >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 relative z-10 scrollbar-hide">
            {/* Empty State */}
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-fadeIn">
                <div className="relative mb-6">
                  {/* Main icon with animations */}
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-200/50 shadow-lg animate-avatar-pulse">
                    <Sparkles className="w-10 h-10 text-emerald-500 animate-subtle-bounce" />
                  </div>
                  
                  {/* Orbiting elements */}
                  <div className="absolute inset-0 animate-radar">
                    <div className="absolute -top-2 left-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-lg" />
                  </div>
                  <div className="absolute inset-0 animate-radar" style={{ animationDelay: '-1s' }}>
                    <div className="absolute top-1/2 -right-2 w-2 h-2 bg-blue-400 rounded-full shadow-lg" />
                  </div>
                  <div className="absolute inset-0 animate-radar" style={{ animationDelay: '-2s' }}>
                    <div className="absolute -bottom-2 left-1/2 w-2.5 h-2.5 bg-purple-400 rounded-full shadow-lg" />
                  </div>
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl blur-2xl -z-10 animate-pulse" />
                </div>
                
                <h4 className="text-xl font-bold text-zinc-800 mb-2">
                  Olá! Sou o <span className="text-shimmer">FinAI</span>
                </h4>
                <p className="text-zinc-500 text-sm mb-8 max-w-sm leading-relaxed">
                  Seu assistente financeiro inteligente. Posso analisar gastos, dar dicas de economia e responder suas dúvidas.
                </p>

                {/* Quick Actions */}
                <div className="w-full max-w-sm space-y-2.5">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-200" />
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Experimente</p>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-200" />
                  </div>
                  
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => onSendMessage(action.query)}
                      className="w-full p-3.5 bg-white hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-blue-50/30 border border-zinc-200 hover:border-emerald-300 rounded-xl text-left text-sm text-zinc-600 hover:text-zinc-800 transition-all group flex items-center gap-3 shadow-sm hover:shadow-md animate-slideUpFade"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform border border-emerald-200/50">
                        {action.icon}
                      </div>
                      <span className="flex-1 font-medium">{action.label}</span>
                      <ChevronRight size={16} className="text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
                
                {/* Feature badges */}
                <div className="flex items-center gap-2 mt-8 flex-wrap justify-center">
                  <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 font-medium">
                    💡 Insights Inteligentes
                  </span>
                  <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 font-medium">
                    📊 Análise em Tempo Real
                  </span>
                  <span className="text-[10px] px-2 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100 font-medium">
                    🎯 Dicas Personalizadas
                  </span>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-message-bounce`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center mr-2.5 shrink-0 border border-emerald-200/50 shadow-sm relative group">
                    <Cpu size={14} className="text-emerald-600" />
                    {/* Pulse effect on hover */}
                    <div className="absolute inset-0 bg-emerald-400/20 rounded-xl opacity-0 group-hover:opacity-100 animate-ping" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed message-hover ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 text-white rounded-br-md shadow-lg' 
                      : 'bg-white text-zinc-700 rounded-bl-md border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-100'
                  }`}>
                    {msg.role === 'assistant' && index === messages.length - 1 && !isLoading ? (
                      <TypingText text={msg.text} speed={12} />
                    ) : (
                      msg.role === 'assistant' ? formatMessageText(msg.text) : msg.text
                    )}
                    
                    {/* Action Buttons */}
                    {msg.role === 'assistant' && msg.uiActions && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-100">
                        {msg.uiActions.map(action => {
                          const loading = chatActionLoadingId === `${msg.id}:${action.id}`;
                          const disabled = !!msg.ctaStatus || loading || isLoading;
                          return (
                            <button
                              key={action.id}
                              disabled={disabled}
                              onClick={() => onChatAction && onChatAction(msg, action.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                action.action === 'approve_cta' 
                                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm' 
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {loading ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Processando
                                </span>
                              ) : action.label}
                            </button>
                          );
                        })}
                        {msg.ctaStatus === 'approved' && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <Sparkles size={10} /> Adicionado!
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-start animate-message-bounce">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center mr-2.5 shrink-0 border border-emerald-200/50 shadow-sm animate-thinking-bubble">
                  <Cpu size={14} className="text-emerald-600" />
                </div>
                <div className="bg-gradient-to-r from-white to-emerald-50/30 px-5 py-3.5 rounded-2xl rounded-bl-md border border-emerald-100 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full typing-dot" />
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">Analisando seus dados...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="relative z-10 p-3 md:p-4 border-t border-zinc-100 bg-gradient-to-b from-white/90 to-white/80 backdrop-blur-md">
            <form onSubmit={handleSend} className="relative">
              <div className={`relative rounded-xl transition-all duration-300 ${
                isInputFocused 
                  ? 'ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-100' 
                  : 'shadow-sm'
              }`}>
                <input 
                  ref={inputRef}
                  type="text" 
                  placeholder="Pergunte algo sobre suas finanças..." 
                  className="w-full pl-4 pr-20 py-3.5 bg-white border border-zinc-200 rounded-xl focus:border-emerald-300 focus:bg-white transition-all text-sm outline-none text-zinc-800 placeholder-zinc-400"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  disabled={isLoading}
                />
                
                {/* Input Actions */}
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button 
                    type="submit" 
                    disabled={!inputText.trim() || isLoading}
                    className="p-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-400 text-white rounded-xl transition-all disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 active:scale-95 btn-feedback"
                  >
                    <Send size={16} className={inputText.trim() ? 'animate-subtle-bounce' : ''} />
                  </button>
                </div>
                
                {/* Character count or hint */}
                {inputText.length > 0 && (
                  <div className="absolute left-4 -bottom-5 text-[10px] text-zinc-400 animate-fadeIn">
                    {inputText.length} caracteres
                  </div>
                )}
              </div>
              
              {/* Powered by indicator with animation */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-200" />
                <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                  <Sparkles size={10} className="text-emerald-400 animate-pulse" />
                  <span className="font-medium">Powered by Gemini AI</span>
                </p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-200" />
              </div>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ImmersiveChat;
