import React from 'react';
import { Sparkles, ArrowRight, AlertTriangle, Repeat, CreditCard, Copy, TrendingUp } from 'lucide-react';
import { PotentialSavingsResult, SavingsItem } from '../services/savingsService';

interface RiskCategory { category: string; current: number; projected: number; limit: number }

interface PotentialSavingsProps {
  data: PotentialSavingsResult;
  riskCategories?: RiskCategory[];
  onViewDetails: () => void;
}

const PotentialSavingsCard: React.FC<PotentialSavingsProps> = ({ data, riskCategories = [], onViewDetails }) => {
  // If no data and no risks, don't show? Or show empty state?
  // The original code returned null if totalPotential === 0.
  // Now we might have risks but no savings.
  if (data.totalPotential === 0 && riskCategories.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'duplicate': return <Copy size={16} className="text-orange-500" />;
      case 'subscription': return <Repeat size={16} className="text-blue-500" />;
      case 'fee': return <AlertTriangle size={16} className="text-red-500" />;
      case 'risk': return <TrendingUp size={16} className="text-rose-500" />;
      default: return <CreditCard size={16} className="text-zinc-500" />;
    }
  };

  const risks = riskCategories.map(r => ({
    id: `risk-${r.category}`,
    title: r.category,
    description: `${((r.projected / r.limit) * 100).toFixed(0)}% do limite`,
    amount: r.projected, // Showing projected amount
    type: 'risk',
    isRisk: true
  }));

  // Combine risks and savings items. Prioritize risks.
  const allItems = [...risks, ...data.items];

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-zinc-900 rounded-2xl md:rounded-3xl p-4 md:p-6 text-white shadow-xl relative overflow-hidden">
      {/* Background Effects - Hidden on mobile */}
      <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:gap-8 md:items-center md:justify-between">
        
        {/* Left Side: Main Value */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <div className="p-1.5 md:p-2 bg-white/10 rounded-lg text-indigo-300">
              <Sparkles size={16} className="md:w-5 md:h-5" />
            </div>
            <span className="text-indigo-200 font-medium text-[10px] md:text-sm uppercase tracking-wider">Economia Potencial</span>
          </div>
          
          <h3 className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2 tracking-tight">
            R$ {data.totalPotential.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </h3>
          <p className="text-indigo-200/80 text-xs md:text-sm hidden md:block max-w-md">
            {riskCategories.length > 0 
              ? `${riskCategories.length} categorias em risco`
              : "Oportunidades de economia identificadas"}
          </p>
          
          <button 
            onClick={onViewDetails}
            className="mt-3 md:mt-6 bg-white text-indigo-900 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm active:bg-indigo-50 transition-colors flex items-center gap-2 shadow-lg"
          >
            Ver análise
            <ArrowRight size={14} className="md:w-4 md:h-4" />
          </button>
        </div>

        {/* Right Side: Top Items - Simplified on mobile */}
        <div className="hidden md:block md:w-auto md:min-w-[280px]">
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
              <span>Destaques</span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-indigo-200">{allItems.length}</span>
            </h4>
            
            <div className="space-y-2">
              {allItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-lg">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-white/10">
                    {getIcon(item.type)}
                  </div>
                  <p className={`text-xs font-medium truncate flex-1 ${item.type === 'risk' ? 'text-rose-300' : 'text-white'}`}>{item.title}</p>
                  <span className={`text-xs font-bold ${item.type === 'risk' ? 'text-rose-300' : 'text-white'}`}>
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

export default PotentialSavingsCard;
