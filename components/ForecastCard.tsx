import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ForecastResult } from '../services/forecastService';

interface ForecastCardProps {
  forecast: ForecastResult;
}

const ForecastCard: React.FC<ForecastCardProps> = ({ forecast }) => {
  const isPositive = forecast.predictedBalance >= 0;

  return (
    <div className={`bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 hover:shadow-lg transition-all group flex flex-col h-full`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <h3 className="font-bold text-zinc-800 text-lg">Previsão do Mês</h3>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 px-2 py-1 rounded-lg">Estimativa</span>
      </div>

      <div className="mb-6">
        <p className="text-zinc-400 text-sm font-medium mb-1">Saldo Final Previsto</p>
        <h3 className={`text-3xl font-bold tracking-tight ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          R$ {forecast.predictedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </h3>
        <p className="text-xs text-zinc-400 mt-2">
          Baseado em gastos fixos e média diária.
        </p>
      </div>
    </div>
  );
};

export default ForecastCard;
