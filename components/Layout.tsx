import React, { ReactNode, useState } from 'react';
import { Home, Plus, PieChart, MessageSquareText, X, Sparkles, Zap, AlertTriangle, Settings, Calendar, Repeat, TrendingUp, Heart, BarChart3, DollarSign, Bell } from 'lucide-react';
import { ChatMessage } from '../types';
import { SmartAlert } from '../services/forecastService';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isChatLoading: boolean;
  onChatAction?: (message: ChatMessage, actionId: string) => void;
  chatActionLoadingId?: string | null;
  extraPanel?: ReactNode;
  alerts?: SmartAlert[];
  isTurboMode?: boolean;
  onToggleTurboMode?: () => void;
  isNotificationsOpen?: boolean;
  onToggleNotifications?: () => void;
  unreadAlertsCount?: number;
}

// Helper to parse simple markdown bold syntax (**text**)
const formatMessageText = (text: string) => {
  // Split by **text** pattern
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-emerald-600 dark:text-emerald-400">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  isChatOpen,
  onToggleChat,
  chatMessages,
  onSendMessage,
  onChatAction,
  chatActionLoadingId,
  isChatLoading,
  extraPanel,
  alerts = [],
  isTurboMode = false,
  onToggleTurboMode,
  isNotificationsOpen = false,
  onToggleNotifications,
  unreadAlertsCount = 0
}) => {
  const [inputText, setInputText] = React.useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Cleanup hover timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  // Filter alerts for header (Overspend, Turbo, Frequent Habits, and Large Expenses)
  const headerAlerts = alerts.filter(a => 
    a.id.startsWith('overspend') || 
    a.id.startsWith('freq-') || 
    a.title.includes('Hábito Frequente') ||
    a.id.startsWith('large-')
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans relative overflow-hidden flex flex-row selection:bg-emerald-500 selection:text-white">
      
      {/* Background Graphic Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px]"></div>
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-zinc-300/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-[80px]"></div>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isChatOpen ? 'mr-0 md:mr-[400px]' : ''} relative z-10`}>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Sticky Header - Mobile Optimized */}
          <header className="sticky top-0 z-30 bg-zinc-50/95 backdrop-blur-md border-b border-zinc-200/50 px-4 py-3 md:px-10 md:py-4 flex items-center justify-between transition-all">
               <div className="flex items-center gap-2 md:gap-3">
                 <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/20 active:scale-95 transition-transform duration-300">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-emerald-500 rounded-full"></div>
                 </div>
                 <div>
                   <span className="font-bold text-lg md:text-xl tracking-tight text-zinc-900 block leading-none">FinAI</span>
                   <span className="text-[10px] md:text-xs text-zinc-400 font-medium hidden sm:block">Controle Inteligente</span>
                 </div>
               </div>

               {/* Mobile Header Actions */}
               <div className="flex items-center gap-2 md:gap-3">
                 {/* Notifications Button */}
                 {onToggleNotifications && (
                   <button
                     onClick={onToggleNotifications}
                     className="p-2 rounded-full active:bg-zinc-200 md:hover:bg-zinc-100 text-zinc-400 active:text-zinc-900 md:hover:text-zinc-900 transition-colors relative"
                     title="Notificações"
                   >
                     <Bell size={18} className="md:w-5 md:h-5" />
                     {unreadAlertsCount > 0 && (
                       <div className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-5 md:h-5 bg-rose-500 rounded-full flex items-center justify-center text-white text-[9px] md:text-[10px] font-bold">
                         {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                       </div>
                     )}
                   </button>
                 )}

                 <button
                    onClick={() => onTabChange('settings')}
                    className="p-2 rounded-full active:bg-zinc-200 md:hover:bg-zinc-100 text-zinc-400 active:text-zinc-900 md:hover:text-zinc-900 transition-colors"
                    title="Configurações"
                 >
                    <Settings size={18} className="md:w-5 md:h-5" />
                 </button>

                 {/* Header Alerts - Hidden on mobile, shown on desktop */}
                 <div className="hidden md:flex items-center gap-2">
                   {headerAlerts.slice(0, 2).map(alert => (
                     <div key={alert.id} className="relative group">
                       <div className={`p-2 rounded-full cursor-help transition-colors ${
                          alert.type === 'danger' ? 'bg-rose-100 text-rose-600' : 
                          alert.type === 'warning' ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'
                       }`}>
                         {alert.id.startsWith('freq-') || alert.title.includes('Hábito Frequente') ? <Repeat size={18} /> : 
                          alert.id.startsWith('large-') ? <TrendingUp size={18} /> :
                          <AlertTriangle size={18} />}
                       </div>
                       {/* Tooltip - Desktop only */}
                       <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white rounded-xl shadow-xl border border-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0">
                         <h4 className={`font-bold text-sm mb-1 ${
                            alert.type === 'danger' ? 'text-rose-600' : 
                            alert.type === 'warning' ? 'text-orange-600' : 
                            'text-blue-600'
                         }`}>{alert.title}</h4>
                         <p className="text-xs text-zinc-600">{alert.message}</p>
                       </div>
                     </div>
                   ))}
                 </div>

                 {/* Turbo Mode Toggle */}
                 {onToggleTurboMode && (
                   <button 
                     onClick={onToggleTurboMode}
                     className={`p-2 rounded-full transition-all flex items-center justify-center active:scale-90 ${isTurboMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-zinc-100 text-zinc-400 active:bg-zinc-200'}`}
                   >
                     <Zap size={18} className={`md:w-5 md:h-5 ${isTurboMode ? 'fill-current' : ''}`} />
                   </button>
                 )}

                 <div className="w-px h-5 md:h-6 bg-zinc-200 mx-1 md:mx-2 hidden sm:block"></div>

                 {/* Chat Button - Desktop */}
                 <button 
                    onClick={onToggleChat}
                    className={`hidden md:flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 ${isChatOpen ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-200 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5'}`}
                 >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isChatOpen ? 'bg-zinc-200 text-zinc-500' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Sparkles size={16} />
                    </div>
                    <span className={`text-sm font-medium ${isChatOpen ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      {isChatOpen ? 'Ativo' : 'Assistente IA'}
                    </span>
                 </button>
                 
                 {/* Chat Button - Mobile */}
                 <button 
                    onClick={onToggleChat}
                    className={`md:hidden flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-300 active:scale-95 ${isChatOpen ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-200 active:border-emerald-200'}`}
                 >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isChatOpen ? 'bg-zinc-200 text-zinc-500' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Sparkles size={14} />
                    </div>
                 </button>
               </div>
            </header>

          <div className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-10 pb-28 md:pb-32">
            <div key={activeTab} className="animate-fadeIn">
              {children}
            </div>
          </div>
        </div>

        {/* Floating Island Navigation - Desktop Version */}
        <div className="hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="animate-slideUp pointer-events-auto">
          <nav className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 text-zinc-400 rounded-2xl px-3 py-2.5 shadow-2xl shadow-zinc-900/40 flex items-center gap-1 transition-all">
            
            <button
              onClick={() => onTabChange('dashboard')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('dashboard');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'dashboard' || (hoveredTab === null && activeTab === 'dashboard')) ? '85px' : '0px',
                  marginLeft: (hoveredTab === 'dashboard' || (hoveredTab === null && activeTab === 'dashboard')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'dashboard' || (hoveredTab === null && activeTab === 'dashboard')) ? 1 : 0
                }}
              >
                Dashboard
              </span>
            </button>

            <button
              onClick={() => onTabChange('insights')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('insights');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'insights' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <PieChart size={22} strokeWidth={activeTab === 'insights' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'insights' || (hoveredTab === null && activeTab === 'insights')) ? '65px' : '0px',
                  marginLeft: (hoveredTab === 'insights' || (hoveredTab === null && activeTab === 'insights')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'insights' || (hoveredTab === null && activeTab === 'insights')) ? 1 : 0
                }}
              >
                Insights
              </span>
            </button>

            <button
              onClick={() => onTabChange('reports')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('reports');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'reports' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <BarChart3 size={22} strokeWidth={activeTab === 'reports' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'reports' || (hoveredTab === null && activeTab === 'reports')) ? '80px' : '0px',
                  marginLeft: (hoveredTab === 'reports' || (hoveredTab === null && activeTab === 'reports')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'reports' || (hoveredTab === null && activeTab === 'reports')) ? 1 : 0
                }}
              >
                Relatórios
              </span>
            </button>

            <button
              onClick={() => onTabChange('add')}
              className="bg-emerald-500 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-105 transition-all mx-1 shrink-0"
            >
              <Plus size={24} strokeWidth={3} />
            </button>

            <button
              onClick={() => onTabChange('budgets')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('budgets');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'budgets' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <DollarSign size={22} strokeWidth={activeTab === 'budgets' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'budgets' || (hoveredTab === null && activeTab === 'budgets')) ? '90px' : '0px',
                  marginLeft: (hoveredTab === 'budgets' || (hoveredTab === null && activeTab === 'budgets')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'budgets' || (hoveredTab === null && activeTab === 'budgets')) ? 1 : 0
                }}
              >
                Orçamentos
              </span>
            </button>

            <button
              onClick={() => onTabChange('agenda')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('agenda');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'agenda' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <Calendar size={22} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'agenda' || (hoveredTab === null && activeTab === 'agenda')) ? '60px' : '0px',
                  marginLeft: (hoveredTab === 'agenda' || (hoveredTab === null && activeTab === 'agenda')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'agenda' || (hoveredTab === null && activeTab === 'agenda')) ? 1 : 0
                }}
              >
                Agenda
              </span>
            </button>

            <button
              onClick={() => onTabChange('planning')}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredTab('planning');
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredTab(null), 2000);
              }}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center overflow-hidden ${activeTab === 'planning' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <Heart size={22} strokeWidth={activeTab === 'planning' ? 2.5 : 2} className="shrink-0" />
              <span 
                className="text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out"
                style={{
                  width: (hoveredTab === 'planning' || (hoveredTab === null && activeTab === 'planning')) ? '65px' : '0px',
                  marginLeft: (hoveredTab === 'planning' || (hoveredTab === null && activeTab === 'planning')) ? '8px' : '0px',
                  opacity: (hoveredTab === 'planning' || (hoveredTab === null && activeTab === 'planning')) ? 1 : 0
                }}
              >
                Desejos
              </span>
            </button>

          </nav>
          </div>
        </div>
        
        {/* Floating Island Navigation - Mobile Version */}
        <div className="md:hidden fixed inset-x-0 bottom-0 pb-4 flex justify-center z-40 pointer-events-none px-3">
          <div className="animate-slideUp pointer-events-auto w-full max-w-md">
          <nav className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 text-zinc-400 rounded-2xl px-2 py-2 shadow-2xl shadow-zinc-900/40 flex items-center justify-between gap-1 transition-all">
            
            <div className="flex items-center gap-0.5 flex-1 justify-around">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center active:scale-90 ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white shadow-inner' : 'active:bg-zinc-800/50 active:text-zinc-200'}`}
              >
                <Home size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
              </button>

              <button
                onClick={() => onTabChange('insights')}
                className={`p-2.5 rounded-xl transition-all duration-200 active:scale-90 ${activeTab === 'insights' ? 'bg-zinc-800 text-white shadow-inner' : 'active:bg-zinc-800/50 active:text-zinc-200'}`}
              >
                <PieChart size={20} strokeWidth={activeTab === 'insights' ? 2.5 : 2} />
              </button>
            </div>

            <button
              onClick={() => onTabChange('add')}
              className="bg-emerald-500 text-white p-3 rounded-xl shadow-lg shadow-emerald-500/20 active:bg-emerald-600 active:scale-95 transition-all flex-shrink-0 mx-1"
            >
              <Plus size={22} strokeWidth={3} />
            </button>

            <div className="flex items-center gap-0.5 flex-1 justify-around">
              <button
                onClick={() => onTabChange('agenda')}
                className={`p-2.5 rounded-xl transition-all duration-200 active:scale-90 ${activeTab === 'agenda' ? 'bg-zinc-800 text-white shadow-inner' : 'active:bg-zinc-800/50 active:text-zinc-200'}`}
              >
                <Calendar size={20} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} />
              </button>

              <button
                onClick={() => onTabChange('planning')}
                className={`p-2.5 rounded-xl transition-all duration-200 active:scale-90 ${activeTab === 'planning' ? 'bg-zinc-800 text-white shadow-inner' : 'active:bg-zinc-800/50 active:text-zinc-200'}`}
              >
                <Heart size={20} strokeWidth={activeTab === 'planning' ? 2.5 : 2} />
              </button>
            </div>

          </nav>
          </div>
        </div>
      </main>

      {/* Chat Sidebar (Right Drawer) - Mobile Optimized */}
      <aside 
        className={`fixed inset-y-0 right-0 w-full md:w-[400px] bg-white/95 md:bg-white/80 backdrop-blur-xl border-l border-white/50 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.32,0.72,0,1) ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full bg-white/50">
          <div className="p-4 md:p-6 border-b border-zinc-100 flex justify-between items-center bg-white/80 backdrop-blur-md safe-area-top">
             <div>
               <h3 className="font-bold text-zinc-900 text-base md:text-lg">FinAI Chat</h3>
               <p className="text-[10px] md:text-xs text-zinc-500">Seu consultor financeiro pessoal</p>
             </div>
             <button onClick={onToggleChat} className="p-2.5 active:bg-zinc-200 md:hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 active:text-zinc-900 md:hover:text-zinc-900">
               <X size={22} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-transparent">
             {chatMessages.length === 0 && (
                <div className="text-center mt-20 opacity-0 animate-fadeIn" style={{animationDelay: '0.1s', animationFillMode: 'forwards'}}>
                   <div className="w-16 h-16 bg-gradient-to-tr from-emerald-100 to-zinc-100 rounded-2xl mx-auto flex items-center justify-center mb-4 text-emerald-600 shadow-sm animate-pulse">
                      <Sparkles size={32} />
                   </div>
                   <h4 className="font-bold text-zinc-800 mb-2">Como posso ajudar?</h4>
                   <p className="text-sm text-zinc-500 px-6 leading-relaxed">
                     Analiso seus gastos, dou dicas de economia e respondo dúvidas sobre seu dinheiro.
                   </p>
                </div>
             )}
             {chatMessages.map(msg => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.role === 'user' 
                    ? 'bg-zinc-900 text-white rounded-br-sm' 
                    : 'bg-white border border-zinc-100 text-zinc-700 rounded-bl-sm'
                  }`}>
                    {msg.role === 'assistant' ? formatMessageText(msg.text) : msg.text}
                    {msg.role === 'assistant' && msg.uiActions && (
                      <div className="flex gap-2 mt-3">
                        {msg.uiActions.map(action => {
                          const loading = chatActionLoadingId === `${msg.id}:${action.id}`;
                          const disabled = !!msg.ctaStatus || loading || isChatLoading;
                          return (
                            <button
                              key={action.id}
                              disabled={disabled}
                              onClick={() => onChatAction && onChatAction(msg, action.id)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${action.action === 'approve_cta' ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500' : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              {loading ? 'Processando...' : action.label}
                            </button>
                          );
                        })}
                        {msg.ctaStatus === 'approved' && (
                          <span className="text-[11px] text-emerald-700 font-bold">Adicionado via chat</span>
                        )}
                        {msg.ctaStatus === 'rejected' && (
                          <span className="text-[11px] text-zinc-500 font-bold">A��o descartada</span>
                        )}
                      </div>
                    )}
                  </div>
               </div>
             ))}
             {isChatLoading && (
               <div className="flex justify-start animate-pulse">
                 <div className="bg-white border border-zinc-100 px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm">
                   <div className="flex gap-1.5">
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-75"></div>
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-150"></div>
                   </div>
                 </div>
               </div>
             )}
             <div ref={chatEndRef} />
          </div>

          <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-t border-zinc-100 safe-area-bottom">
            <form onSubmit={handleSend} className="relative">
              <input 
                type="text" 
                placeholder="Ex: Quanto gastei em Uber?" 
                className="w-full pl-4 pr-12 py-3 md:py-4 bg-zinc-50 border border-zinc-200 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 focus:bg-white transition-all text-sm font-medium outline-none text-zinc-800 placeholder-zinc-400"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isChatLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 text-white rounded-lg md:rounded-xl disabled:opacity-50 active:bg-zinc-700 active:scale-95 transition-all shadow-md shadow-zinc-900/10"
              >
                 <MessageSquareText size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile when chat is open */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onToggleChat}
        />
      )}

      {/* Extra Panel (e.g. Review Panel) */}
      {extraPanel}
    </div>
  );
};

export default Layout;
