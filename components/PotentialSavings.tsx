import React from 'react';
import { Sparkles, ArrowRight, AlertTriangle, Repeat, CreditCard, Copy } from 'lucide-react';
import { PotentialSavingsResult, SavingsItem } from '../services/savingsService';

interface PotentialSavingsProps {
  data: PotentialSavingsResult;
  onViewDetails: () => void;
}

const PotentialSavings: React.FC<PotentialSavingsProps> = ({ data, onViewDetails }) => {
  if (data.totalPotential === 0) return null;

  const getIcon = (type: SavingsItem['type']) => {
    switch (type) {
      case 'duplicate': return <Copy size={16} className="text-orange-500" />;
      case 'subscription': return <Repeat size={16} className="text-blue-500" />;
      case 'fee': return <AlertTriangle size={16} className="text-red-500" />;
      default: return <CreditCard size={16} className="text-zinc-500" />;
    }
  };

  const getColor = (type: SavingsItem['type']) => {
    switch (type) {
      case 'duplicate': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'subscription': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'fee': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-zinc-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-8 group">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-10 -ml-10 -mb-10 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        
        {/* Left Side: Main Value */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10 text-indigo-300">
              <Sparkles size={20} />
            </div>
            <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider">Economia Potencial</span>
          </div>
          
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
            R$ {data.totalPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-indigo-200/80 text-sm max-w-md">
            Identificamos oportunidades de economia imediata baseadas nos seus padrões de gastos recentes.
          </p>
          
          <button 
            onClick={onViewDetails}
            className="mt-6 bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/20"
          >
            Criar plano para economizar
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Right Side: Top Items */}
        <div className="w-full md:w-auto md:min-w-[320px]">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
              <span>Principais Desperdícios</span>
              <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-indigo-200">{data.items.length} encontrados</span>
            </h4>
            
            <div className="space-y-3">
              {data.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/10`}>
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-xs text-indigo-200/70 truncate">{item.description}</p>
                  </div>
                  <span className="text-sm font-bold text-white whitespace-nowrap">
                    R$ {item.amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PotentialSavings;
