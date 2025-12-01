import React, { ReactNode } from 'react';
import { Home, Plus, PieChart, Sparkles, Zap, AlertTriangle, Settings, Calendar, Repeat, TrendingUp, Heart, BarChart3, DollarSign, Bell } from 'lucide-react';
import { ChatMessage } from '../types';
import { SmartAlert } from '../services/forecastService';
import FloatingOrbs from './FloatingOrbs';
import ParticleBackground from './ParticleBackground';
import NeuralGrid from './NeuralGrid';
import ImmersiveChat from './ImmersiveChat';

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
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup hover timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Filter alerts for header (Overspend, Turbo, Frequent Habits, and Large Expenses)
  const headerAlerts = alerts.filter(a => 
    a.id.startsWith('overspend') || 
    a.id.startsWith('freq-') || 
    a.title.includes('Hábito Frequente') ||
    a.id.startsWith('large-')
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans relative overflow-hidden flex flex-row selection:bg-emerald-500 selection:text-white">
      
      {/* Enhanced Background Visual Effects */}
      <NeuralGrid variant="sparse" animated={true} />
      <FloatingOrbs variant="default" />
      <ParticleBackground 
        particleCount={45} 
        colors={['#10b981', '#3b82f6', '#8b5cf6', '#06b6d4']} 
        connectionDistance={180}
        mouseInfluence={250}
        speed={0.25}
        chatActive={isChatOpen}
        isProcessing={isChatLoading}
      />

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isChatOpen ? 'mr-0 md:mr-[400px]' : ''} relative z-10`}>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Sticky Header - Mobile Optimized */}
          <header className="sticky top-0 z-30 bg-zinc-50/95 backdrop-blur-md border-b border-zinc-200/50 px-4 py-3 md:px-10 md:py-4 flex items-center justify-between transition-all">
               <div className="flex items-center gap-2 md:gap-3">
                 <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-900 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/20 active:scale-95 transition-transform duration-300 relative group">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-emerald-500 rounded-full animate-breathing-glow"></div>
                    {/* Glow ring effect on hover */}
                    <div className="absolute inset-0 rounded-lg md:rounded-xl bg-emerald-500/20 opacity-0 group-hover:opacity-100 group-hover:animate-glow-ring pointer-events-none"></div>
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

      {/* Immersive Chat Experience */}
      <ImmersiveChat
        isOpen={isChatOpen}
        onClose={onToggleChat}
        messages={chatMessages}
        onSendMessage={onSendMessage}
        isLoading={isChatLoading}
        onChatAction={onChatAction}
        chatActionLoadingId={chatActionLoadingId}
      />

      {/* Extra Panel (e.g. Review Panel) */}
      {extraPanel}
    </div>
  );
};

export default Layout;
