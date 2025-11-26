import React from 'react';
import { OverspendProjection } from '../types';
import { AlertTriangle, TrendingDown, Calendar, DollarSign, Target } from 'lucide-react';

interface OverspendProjectionCardProps {
  projection: OverspendProjection;
  monthlyIncome: number;
}

const OverspendProjectionCard: React.FC<OverspendProjectionCardProps> = ({ projection, monthlyIncome }) => {
  if (!projection.willOverspend) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
            <Target size={28} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-emerald-900 text-lg mb-1">Projeção Positiva</h3>
            <p className="text-sm text-emerald-700 mb-4">
              Você está no caminho certo! Com base no seu ritmo atual, não há projeção de estouro para este mês.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Orçamento Mensal</span>
                  <span className="text-lg font-bold text-emerald-900">R$ {monthlyIncome.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const daysText = projection.daysUntilOverspend === 1 ? '1 dia' : `${projection.daysUntilOverspend} dias`;
  const overspendDate = projection.projectedOverspendDate
    ? new Date(projection.projectedOverspendDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : 'N/A';

  return (
    <div className="bg-gradient-to-br from-rose-50 to-orange-50 border-2 border-rose-200 rounded-3xl p-6 shadow-lg">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0 animate-pulse">
          <AlertTriangle size={28} className="text-rose-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-rose-900 text-lg mb-1">⚡ Alerta de Estouro</h3>
          <p className="text-sm text-rose-700">
            Com base no seu ritmo de gastos atual, você <strong>estourará o orçamento</strong> antes do fim do mês.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-rose-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-rose-600" />
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Estouro em</span>
          </div>
          <p className="text-2xl font-bold text-rose-900">{daysText}</p>
          <p className="text-xs text-rose-600 mt-1">{overspendDate}</p>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-rose-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-rose-600" />
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Valor Projetado</span>
          </div>
          <p className="text-2xl font-bold text-rose-900">
            +R$ {projection.projectedOverspendAmount?.toFixed(0)}
          </p>
          <p className="text-xs text-rose-600 mt-1">Acima do orçamento</p>
        </div>
      </div>

      {/* Category at Risk */}
      {projection.categoryAtRisk && (
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-orange-200 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide mb-1">Categoria de Risco</p>
              <p className="text-lg font-bold text-orange-900">{projection.categoryAtRisk}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Recommended Daily Limit */}
      <div className="bg-gradient-to-r from-rose-100 to-orange-100 rounded-xl p-4 border border-rose-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-rose-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-rose-900 uppercase tracking-wide mb-1">Limite Diário Recomendado</p>
            <p className="text-2xl font-bold text-rose-900 mb-1">
              R$ {projection.recommendedDailyLimit?.toFixed(2)}
            </p>
            <p className="text-xs text-rose-700 leading-relaxed">
              Para evitar estouro, mantenha seus gastos abaixo deste valor por dia até o fim do mês.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverspendProjectionCard;
