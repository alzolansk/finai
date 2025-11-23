import React, { ReactNode } from 'react';
import { Home, Plus, PieChart, MessageSquareText, X, Sparkles, Map, Zap, AlertTriangle } from 'lucide-react';
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
  extraPanel?: ReactNode;
  alerts?: SmartAlert[];
  isTurboMode?: boolean;
  onToggleTurboMode?: () => void;
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
  isChatLoading,
  extraPanel,
  alerts = [],
  isTurboMode = false,
  onToggleTurboMode
}) => {
  const [inputText, setInputText] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  // Filter alerts for header (Overspend and Turbo)
  const headerAlerts = alerts.filter(a => a.id.startsWith('overspend'));

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
          {/* Sticky Header */}
          <header className="sticky top-0 z-30 bg-zinc-50/80 backdrop-blur-md border-b border-zinc-200/50 px-6 py-4 md:px-10 flex items-center justify-between transition-all">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/20 hover:scale-105 transition-transform duration-300">
                    <div className="w-4 h-4 bg-emerald-500 rounded-full"></div>
                 </div>
                 <div>
                   <span className="font-bold text-xl tracking-tight text-zinc-900 block leading-none">FinAI</span>
                   <span className="text-xs text-zinc-400 font-medium">Controle Inteligente</span>
                 </div>
               </div>

               <div className="flex items-center gap-3">
                 {/* Header Alerts */}
                 {headerAlerts.map(alert => (
                   <div key={alert.id} className="relative group">
                     <div className={`p-2 rounded-full cursor-help transition-colors ${alert.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                       <AlertTriangle size={20} />
                     </div>
                     {/* Tooltip */}
                     <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white rounded-xl shadow-xl border border-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0">
                       <h4 className={`font-bold text-sm mb-1 ${alert.type === 'danger' ? 'text-rose-600' : 'text-orange-600'}`}>{alert.title}</h4>
                       <p className="text-xs text-zinc-600">{alert.message}</p>
                     </div>
                   </div>
                 ))}

                 {/* Turbo Mode Toggle */}
                 {onToggleTurboMode && (
                   <button 
                     onClick={onToggleTurboMode}
                     className={`relative group p-2 rounded-full transition-all flex items-center justify-center ${isTurboMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
                   >
                     <Zap size={20} className={isTurboMode ? 'fill-current' : ''} />
                     
                     {/* Tooltip */}
                     <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-white rounded-xl shadow-xl border border-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 transform translate-y-2 group-hover:translate-y-0 text-left">
                       <h4 className="font-bold text-sm mb-1 text-indigo-600">Modo Turbo {isTurboMode ? 'Ativo' : 'Inativo'}</h4>
                       <p className="text-xs text-zinc-600">
                         {isTurboMode 
                           ? 'Limites de gastos reduzidos em 20% para maximizar economia.' 
                           : 'Ative para reduzir limites e economizar mais.'}
                       </p>
                     </div>
                   </button>
                 )}

                 <div className="w-px h-6 bg-zinc-200 mx-2"></div>

                 <button 
                    onClick={onToggleChat}
                    className={`group flex items-center gap-3 px-5 py-2.5 rounded-full border transition-all duration-300 active:scale-95 ${isChatOpen ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-200 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5'}`}
                 >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isChatOpen ? 'bg-zinc-200 text-zinc-500' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'}`}>
                      <Sparkles size={16} />
                    </div>
                    <span className={`text-sm font-medium ${isChatOpen ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      {isChatOpen ? 'Assistente Ativo' : 'Assistente IA'}
                    </span>
                 </button>
               </div>
            </header>

          <div className="max-w-7xl mx-auto w-full p-6 md:p-10 pb-32">
            <div key={activeTab} className="animate-fadeIn">
              {children}
            </div>
          </div>
        </div>

        {/* Floating Island Navigation */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-slideUp">
          <nav className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 text-zinc-400 rounded-2xl px-2 py-2 shadow-2xl shadow-zinc-900/40 flex items-center gap-2 transition-all hover:scale-[1.01]">
            
            <button
              onClick={() => onTabChange('dashboard')}
              className={`p-4 rounded-xl transition-all duration-300 flex items-center gap-2 hover:scale-110 active:scale-90 ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <Home size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            </button>
            
            {/* Prominent Add Button */}
            <button
              onClick={() => onTabChange('add')}
              className="bg-emerald-500 text-white p-4 mx-2 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 hover:scale-110 active:scale-95 transition-all group"
            >
              <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            <button
              onClick={() => onTabChange('insights')}
              className={`p-4 rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 ${activeTab === 'insights' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <PieChart size={24} strokeWidth={activeTab === 'insights' ? 2.5 : 2} />
            </button>

            <button
              onClick={() => onTabChange('planning')}
              className={`p-4 rounded-xl transition-all duration-300 hover:scale-110 active:scale-90 ${activeTab === 'planning' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <Map size={24} strokeWidth={activeTab === 'planning' ? 2.5 : 2} />
            </button>

          </nav>
        </div>
      </main>

      {/* Chat Sidebar (Right Drawer) */}
      <aside 
        className={`fixed inset-y-0 right-0 w-full md:w-[400px] bg-white/80 backdrop-blur-xl border-l border-white/50 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.32,0.72,0,1) ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full bg-white/50">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
             <div>
               <h3 className="font-bold text-zinc-900 text-lg">FinAI Chat</h3>
               <p className="text-xs text-zinc-500">Seu consultor financeiro pessoal</p>
             </div>
             <button onClick={onToggleChat} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
               <X size={20} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-transparent">
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

          <div className="p-4 bg-white/80 backdrop-blur-md border-t border-zinc-100">
            <form onSubmit={handleSend} className="relative">
              <input 
                type="text" 
                placeholder="Ex: Quanto gastei em Uber este mês?" 
                className="w-full pl-5 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 focus:bg-white transition-all text-sm font-medium outline-none text-zinc-800 placeholder-zinc-400"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isChatLoading}
                className="absolute right-3 top-3 p-2 bg-zinc-900 text-white rounded-xl disabled:opacity-50 hover:bg-zinc-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-zinc-900/10"
              >
                 <MessageSquareText size={18} />
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