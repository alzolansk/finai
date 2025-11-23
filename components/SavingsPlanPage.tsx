import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, UserSettings } from '../types';
import { generateSavingsPlan, SavingsPlanAction } from '../services/savingsService';
import { getSavingsReviews, saveSavingsReview, SavingsReview } from '../services/storageService';
import { TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Target, ShieldAlert, Calendar, DollarSign, Zap, Check, X, Edit2 } from 'lucide-react';

interface SavingsPlanPageProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  reviews: SavingsReview[];
  onReview: (action: SavingsPlanAction) => void;
  onBack: () => void;
}

const SavingsPlanPage: React.FC<SavingsPlanPageProps> = ({ transactions, settings, reviews, onReview, onBack }) => {
  const plan = useMemo(() => generateSavingsPlan(transactions, settings, reviews), [transactions, settings, reviews]);

  const renderActionCard = (action: SavingsPlanAction, colorClass: string) => {
    const isReviewed = action.status !== 'pending';
    
    return (
      <div key={action.id} className={`bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center group hover:shadow-md transition-all ${isReviewed ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-100'}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isReviewed ? 'bg-zinc-200 text-zinc-500' : `${colorClass} bg-opacity-10`}`}>
            <DollarSign className={isReviewed ? 'text-zinc-500' : colorClass} size={20} />
          </div>
          <div>
            <h4 className={`font-bold ${isReviewed ? 'text-zinc-500' : 'text-zinc-800'}`}>{action.title}</h4>
            <p className="text-sm text-zinc-500">{action.description}</p>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold block ${isReviewed ? 'text-zinc-400 line-through' : colorClass}`}>
                Impacto: R$ {action.originalAmount?.toLocaleString('pt-BR') || action.impact.toLocaleString('pt-BR')}
              </span>
              
              {action.status === 'adjusted' && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Ajustado para R$ {action.impact.toLocaleString('pt-BR')}
                </span>
              )}
              {action.status === 'kept' && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check size={10} /> Mantido
                </span>
              )}
              {action.status === 'dismissed' && (
                <span className="text-xs font-bold text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <X size={10} /> Dispensado
                </span>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => onReview(action)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isReviewed 
            ? 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50' 
            : 'bg-zinc-900 text-white hover:bg-zinc-800'
          }`}
        >
          {isReviewed ? 'Editar' : 'Revisar'}
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fadeIn">
      
      {/* Header / Back */}
      <div className="flex items-center gap-2 text-zinc-400 hover:text-zinc-800 cursor-pointer transition-colors w-fit" onClick={onBack}>
        <ArrowRight className="rotate-180" size={20} />
        <span className="text-sm font-medium">Voltar ao Dashboard</span>
      </div>

      {/* BLOCO 1: Resumo Executivo */}
      <section className="bg-zinc-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-light tracking-tight mb-2">Plano de Economia</h1>
                    <p className="text-zinc-400 text-sm uppercase tracking-wider font-medium">Relatório Executivo Mensal</p>
                </div>
                <div className="text-right">
                    <p className="text-zinc-400 text-xs mb-1">Meta Mensal</p>
                    <p className="text-2xl font-bold text-emerald-400">R$ {plan.executiveSummary.monthlyGoal.toLocaleString('pt-BR')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 border-t border-zinc-800 pt-8">
                <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Economia Potencial (Min)</p>
                    <p className="text-3xl font-bold">R$ {plan.executiveSummary.minSavings.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Economia Potencial (Max)</p>
                    <p className="text-3xl font-bold text-emerald-400">R$ {plan.executiveSummary.maxSavings.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Previsão</p>
                    <p className="text-xl font-medium text-zinc-300 flex items-center gap-2">
                        {plan.executiveSummary.forecast}
                        <TrendingUp size={16} className="text-emerald-500" />
                    </p>
                </div>
            </div>

            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/50 backdrop-blur-sm">
                <p className="text-zinc-300 leading-relaxed">
                    {plan.executiveSummary.summaryText}
                </p>
            </div>
        </div>
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      </section>

      {/* BLOCO 2: Diagnóstico Inteligente */}
      <section className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <AlertCircle size={24} />
              </div>
              <h2 className="text-xl font-bold text-zinc-800">Diagnóstico Inteligente</h2>
          </div>
          <div className="prose prose-zinc max-w-none">
              <p className="text-zinc-600 leading-relaxed whitespace-pre-line">
                  {plan.smartDiagnosis}
              </p>
          </div>
      </section>

      {/* BLOCO 3: Estratégia do Mês */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-emerald-700">
                  <Target size={20} />
                  <h3 className="font-bold">Ajustes</h3>
              </div>
              <p className="text-sm text-emerald-900 leading-relaxed">
                  {plan.monthlyStrategy.adjustments}
              </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-3xl border border-orange-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-orange-700">
                  <ShieldAlert size={20} />
                  <h3 className="font-bold">Alertas</h3>
              </div>
              <p className="text-sm text-orange-900 leading-relaxed">
                  {plan.monthlyStrategy.alerts}
              </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-3xl border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-blue-700">
                  <Calendar size={20} />
                  <h3 className="font-bold">Previsões</h3>
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">
                  {plan.monthlyStrategy.forecasts}
              </p>
          </div>
      </section>

      {/* BLOCO 4: Etapas do Plano */}
      <section className="space-y-6">
          <h2 className="text-2xl font-light text-zinc-800">Plano de Ação</h2>
          
          {/* High Impact */}
          {plan.steps.highImpact.length > 0 && (
              <div className="space-y-4">
                  <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={16} /> Alto Impacto
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                      {plan.steps.highImpact.map(action => renderActionCard(action, 'text-rose-600'))}
                  </div>
              </div>
          )}

          {/* Medium Impact */}
          {plan.steps.mediumImpact.length > 0 && (
              <div className="space-y-4">
                  <h3 className="text-sm font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={16} /> Médio Impacto
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                      {plan.steps.mediumImpact.map(action => renderActionCard(action, 'text-orange-500'))}
                  </div>
              </div>
          )}

          {/* Low Impact */}
          {plan.steps.lowImpact.length > 0 && (
              <div className="space-y-4">
                  <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={16} /> Baixo Impacto
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                      {plan.steps.lowImpact.map(action => renderActionCard(action, 'text-emerald-600'))}
                  </div>
              </div>
          )}
      </section>

      {/* BLOCO 5: Acompanhamento */}
      <section className="bg-zinc-50 rounded-3xl p-8 border border-zinc-200">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-zinc-200 text-zinc-600 rounded-lg">
                  <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-zinc-800">Acompanhamento Semanal</h2>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
              {[1, 2, 3, 4].map(week => (
                  <div key={week} className={`flex-1 h-2 rounded-full ${week === 1 ? 'bg-emerald-500' : 'bg-zinc-200'}`}></div>
              ))}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200">
              <p className="text-zinc-600 font-medium">
                  {plan.weeklyProgress}
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                  Próxima revisão sugerida: {new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString('pt-BR')}
              </p>
          </div>
      </section>

    </div>
  );
};

export default SavingsPlanPage;
