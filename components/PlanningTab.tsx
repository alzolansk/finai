import React from 'react';
import { Transaction, UserSettings, Category } from '../types';
import { ForecastResult } from '../services/forecastService';
import { CheckCircle2, Circle, Target, Users, TrendingDown, ArrowRight } from 'lucide-react';

interface PlanningTabProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  forecast: ForecastResult;
}

const PlanningTab: React.FC<PlanningTabProps> = ({ transactions, settings, forecast }) => {
  
  // Mock Benchmark Data (since we don't have a backend)
  const benchmarkData = {
    [Category.FOOD]: 0.20, // 20% of income
    [Category.HOUSING]: 0.30,
    [Category.TRANSPORT]: 0.10,
    [Category.ENTERTAINMENT]: 0.05,
    [Category.SHOPPING]: 0.10
  };

  const income = settings?.monthlyIncome || 5000; // Fallback for benchmark calc

  return (
    <div className="space-y-8 pb-20 animate-fadeIn">
      <div>
        <h2 className="text-3xl font-light text-zinc-800">Planejamento Inteligente</h2>
        <p className="text-zinc-500 text-sm mt-1">Um plano de ação gerado por IA para o seu mês.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: The Plan */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* 1. Monthly Focus */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-3xl p-8 text-white shadow-xl">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Foco do Mês</h3>
                        <p className="text-zinc-400 text-sm max-w-md">
                            Baseado na sua previsão de saldo de <span className={forecast.predictedBalance >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>R$ {forecast.predictedBalance.toLocaleString('pt-BR')}</span>, 
                            aqui está sua estratégia recomendada.
                        </p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                        <Target className="text-emerald-400" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Meta de Economia</p>
                        <p className="text-2xl font-bold">R$ {settings?.savingsGoal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Teto de Gastos</p>
                        <p className="text-2xl font-bold">R$ {forecast.predictedIncome.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Dias Restantes</p>
                        <p className="text-2xl font-bold">{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()}</p>
                    </div>
                </div>
            </div>

            {/* 2. Smart Budget (Category Limits) */}
            <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
                <h3 className="text-lg font-bold text-zinc-800 mb-6">Orçamento Inteligente</h3>
                <div className="space-y-6">
                    {forecast.riskCategories.map(risk => (
                        <div key={risk.category}>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="font-bold text-zinc-800 block">{risk.category}</span>
                                    <span className="text-xs text-zinc-400">Recomendado: R$ {risk.limit.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`font-bold ${risk.projected > risk.limit ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        R$ {risk.projected.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-xs text-zinc-400 block">Projeção</span>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${risk.projected > risk.limit ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (risk.projected / risk.limit) * 100)}%` }}
                                ></div>
                            </div>
                            {risk.projected > risk.limit && (
                                <div className="mt-2">
                                    <p className="text-xs text-rose-600 flex items-center gap-1 font-bold">
                                        <TrendingDown size={12} />
                                        Corte necessário: R$ {(risk.projected - risk.limit).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 mt-1">
                                        Sugestão: Gaste no máximo <span className="font-bold text-zinc-700">R$ {Math.max(0, (risk.limit - risk.current) / Math.max(1, (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()))).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/dia</span> para recuperar.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                    {forecast.riskCategories.length === 0 && (
                        <p className="text-zinc-400 italic">Nenhuma categoria crítica identificada. Continue assim!</p>
                    )}
                </div>
            </div>

        </div>

        {/* Right Column: Checklist & Benchmark */}
        <div className="space-y-8">
            
            {/* Checklist */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm">
                <h3 className="text-lg font-bold text-zinc-800 mb-4">Checklist Semanal</h3>
                <div className="space-y-3">
                    {[
                        { text: 'Revisar assinaturas inativas', done: false },
                        { text: 'Definir limite para o fim de semana', done: true },
                        { text: 'Categorizar gastos pendentes', done: false },
                        { text: 'Verificar faturas futuras', done: false }
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer group">
                            {item.done ? (
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                            ) : (
                                <Circle className="text-zinc-300 group-hover:text-zinc-400 shrink-0" size={20} />
                            )}
                            <span className={`text-sm ${item.done ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>
                                {item.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Benchmark */}
            <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="text-indigo-600" size={20} />
                    <h3 className="text-lg font-bold text-indigo-900">Comparativo</h3>
                </div>
                <p className="text-sm text-indigo-800 mb-4">
                    Comparado a pessoas com perfil semelhante:
                </p>
                
                <div className="space-y-4">
                    <div className="bg-white/60 rounded-xl p-3">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-indigo-900 font-medium">Alimentação</span>
                            <span className="text-rose-600 font-bold">+12%</span>
                        </div>
                        <div className="w-full bg-indigo-100 h-1.5 rounded-full">
                            <div className="bg-rose-400 h-1.5 rounded-full" style={{ width: '70%' }}></div>
                        </div>
                        <p className="text-[10px] text-indigo-400 mt-1">Você gasta mais que a média.</p>
                    </div>

                    <div className="bg-white/60 rounded-xl p-3">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-indigo-900 font-medium">Transporte</span>
                            <span className="text-emerald-600 font-bold">-5%</span>
                        </div>
                        <div className="w-full bg-indigo-100 h-1.5 rounded-full">
                            <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                        </div>
                        <p className="text-[10px] text-indigo-400 mt-1">Você economiza bem aqui!</p>
                    </div>
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};

export default PlanningTab;
