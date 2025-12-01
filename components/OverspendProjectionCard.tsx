import React from 'react';
import { OverspendProjection } from '../types';
import { AlertTriangle, TrendingDown, Calendar, DollarSign, Target } from 'lucide-react';

interface OverspendProjectionCardProps {
  projection: OverspendProjection;
  monthlyIncome: number;
}

const OverspendProjectionCard: React.FC<OverspendProjectionCardProps> = ({ projection, monthlyIncome }) => {
  if (!projection.willOverspend) {
    // Hide positive projection on mobile to save space
    return (
      <div className="hidden md:block bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Target size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-emerald-900 text-sm">Projeção Positiva</h3>
            <p className="text-xs text-emerald-700">Sem risco de estouro este mês</p>
          </div>
          <span className="text-sm font-bold text-emerald-900">R$ {monthlyIncome.toLocaleString('pt-BR')}</span>
        </div>
      </div>
    );
  }

  const daysText = projection.daysUntilOverspend === 1 ? '1 dia' : `${projection.daysUntilOverspend} dias`;

  return (
    <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-3 md:p-5 shadow-sm">
      {/* Header - Compact */}
      <div className="flex items-center gap-2 md:gap-3 mb-3">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-100 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
          <AlertTriangle size={16} className="md:w-5 md:h-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-rose-900 text-xs md:text-sm">⚡ Alerta de Estouro</h3>
          <p className="text-[10px] md:text-xs text-rose-700 truncate">Estouro previsto em {daysText}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm md:text-lg font-bold text-rose-900">+R$ {projection.projectedOverspendAmount?.toFixed(0)}</p>
          <p className="text-[9px] md:text-[10px] text-rose-600">acima</p>
        </div>
      </div>

      {/* Recommended Daily Limit - Compact */}
      <div className="bg-white/70 rounded-lg md:rounded-xl p-2.5 md:p-3 border border-rose-100 flex items-center gap-2 md:gap-3">
        <div className="w-7 h-7 md:w-8 md:h-8 bg-rose-100 rounded-md md:rounded-lg flex items-center justify-center shrink-0">
          <DollarSign size={14} className="md:w-4 md:h-4 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] md:text-[10px] font-bold text-rose-700 uppercase">Limite diário</p>
          <p className="text-sm md:text-base font-bold text-rose-900">R$ {projection.recommendedDailyLimit?.toFixed(0)}</p>
        </div>
        {projection.categoryAtRisk && (
          <div className="text-right hidden sm:block">
            <p className="text-[9px] text-orange-600 uppercase font-bold">Risco</p>
            <p className="text-xs font-bold text-orange-800">{projection.categoryAtRisk}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverspendProjectionCard;
