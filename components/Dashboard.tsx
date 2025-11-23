import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, UserSettings, TimePeriod } from '../types';
import { SavingsReview } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Target, Wallet, TrendingDown, ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle, Zap } from 'lucide-react';
import { getMonthName, filterTransactionsByPeriod } from '../utils/dateUtils';
import { calculatePotentialSavings } from '../services/savingsService';
import { calculateMonthlyForecast, generateSmartAlerts, SmartAlert } from '../services/forecastService';
import PotentialSavingsCard from './PotentialSavingsCard';
import ForecastCard from './ForecastCard';

interface DashboardProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  reviews: SavingsReview[];
  alerts: SmartAlert[];
  onViewAllHistory: () => void;
  onViewSavingsPlan: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  period: TimePeriod;
  isTurboMode: boolean;
  onToggleTurboMode: () => void;
}

const COLORS = ['#27272a', '#52525b', '#71717a', '#a1a1aa', '#10b981', '#059669', '#047857'];

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  settings, 
  reviews,
  alerts,
  onViewAllHistory,
  onViewSavingsPlan,
  currentDate,
  onDateChange,
  period,
  isTurboMode,
  onToggleTurboMode
}) => {
  
  // 1. Filter Transactions by the selected period (Using effective paymentDate)
  const filteredTransactions = filterTransactionsByPeriod(transactions, currentDate, period);

  // Calculate Potential Savings
  const potentialSavings = useMemo(() => calculatePotentialSavings(transactions, reviews), [transactions, reviews]);

  // Calculate Forecast
  const forecast = useMemo(() => calculateMonthlyForecast(transactions, currentDate, settings, isTurboMode), [transactions, currentDate, settings, isTurboMode]);
  
  // Filter alerts to exclude those shown in header (overspend, frequent habits, large expenses and turbo)
  const bodyAlerts = alerts.filter(a => 
    !a.id.startsWith('overspend') && 
    !a.id.startsWith('freq-') && 
    !a.title.includes('Hábito Frequente') &&
    !a.id.startsWith('large-') &&
    a.id !== 'turbo-active'
  );

  // 2. Calculate Stats based on Filtered Data
  const totalIncome = filteredTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Monthly Goal Progress
  const savings = totalIncome - totalExpense;
  const goalProgress = settings && settings.savingsGoal > 0 ? (savings / settings.savingsGoal) * 100 : 0;
  const isGoalReached = savings >= (settings?.savingsGoal || 0);

  const dataByCategory = (Object.values(
    filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = { name: t.category, value: 0 };
        acc[t.category].value += t.amount;
        return acc;
      }, {} as Record<string, { name: string; value: number }>)
  ) as { name: string; value: number }[]).sort((a, b) => b.value - a.value);

  // Navigation Handlers
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      
      {/* Header & Date Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
        <div>
           <h2 className="text-4xl font-light text-zinc-900 tracking-tight">
              Visão Geral
           </h2>
           <p className="text-zinc-500 mt-1">Seu fluxo de caixa (Regime de Caixa).</p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-zinc-100">
           <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
             <ChevronLeft size={20} />
           </button>
           <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
             <Calendar size={16} className="text-emerald-600" />
             <span className="font-bold text-zinc-800 capitalize">
                {getMonthName(currentDate)}
             </span>
           </div>
           <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
             <ChevronRight size={20} />
           </button>
        </div>
      </div>

      {/* Smart Alerts Section */}
      {bodyAlerts.length > 0 && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bodyAlerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-2xl border flex items-start gap-3 ${
              alert.type === 'danger' ? 'bg-rose-50 border-rose-100 text-rose-900' :
              alert.type === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-900' :
              'bg-blue-50 border-blue-100 text-blue-900'
            }`}>
              <div className={`p-2 rounded-lg shrink-0 ${
                 alert.type === 'danger' ? 'bg-rose-100 text-rose-600' :
                 alert.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                 'bg-blue-100 text-blue-600'
              }`}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm mb-1">{alert.title}</h4>
                <p className="text-xs opacity-80 mb-2">{alert.message}</p>
                {alert.action && (
                  <button className="text-xs font-bold underline hover:opacity-70">
                    {alert.action}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Column - Main Stats & Goals */}
        <div className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Top Cards Grid - Height h-56 (approx 14rem/224px) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Balance Card */}
                <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-2xl flex flex-col justify-between h-56 relative overflow-hidden group transition-all hover:scale-[1.01]">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-emerald-400 border border-zinc-700 shadow-md">
                                <Wallet size={24} />
                            </div>
                            <div className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-400">
                                {period === 'month' ? 'Mensal' : 'Anual'}
                            </div>
                        </div>
                        <p className="text-zinc-400 text-sm font-medium mb-1">Saldo Líquido</p>
                        <h3 className="text-4xl font-bold tracking-tight">
                        R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    {/* Background decor */}
                    <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-zinc-800 rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-700"></div>
                </div>

                {/* Income Card */}
                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-4 hover:border-emerald-200 hover:shadow-emerald-500/10 transition-all group h-56">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform"><ArrowUpRight size={24} /></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">Receitas</span>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-sm mb-1">Entradas</p>
                        <p className="text-3xl font-bold text-zinc-900">R$ {totalIncome.toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                {/* Expense Card */}
                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-4 hover:border-rose-200 hover:shadow-rose-500/10 transition-all group h-56">
                    <div className="flex items-center justify-between">
                         <div className="p-2 bg-rose-50 rounded-xl text-rose-600 group-hover:scale-110 transition-transform"><TrendingDown size={24} /></div>
                         <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-1 rounded-lg">Despesas</span>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-sm mb-1">Saídas</p>
                        <p className="text-3xl font-bold text-zinc-900">R$ {totalExpense.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* Charts & Goals Row - Fixed Height h-80 (20rem/320px) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-80">
                {/* Goal Widget */}
                {settings && period === 'month' && (
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-100 relative overflow-hidden flex flex-col justify-center hover:shadow-lg transition-all hover:border-zinc-200 h-full">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <Target size={20} />
                            </div>
                            <h3 className="font-bold text-zinc-800 text-lg">Meta Mensal</h3>
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-2">
                                <span className={`text-3xl font-bold ${isGoalReached ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                    R$ {Math.max(0, savings).toLocaleString('pt-BR')}
                                </span>
                                <span className="text-zinc-400 font-medium text-sm mb-1">/ R$ {settings.savingsGoal.toLocaleString('pt-BR')}</span>
                            </div>

                            <div className="w-full bg-zinc-100 rounded-full h-4 mb-3 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isGoalReached ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-zinc-800'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, goalProgress))}%` }}
                                ></div>
                            </div>
                            
                            <p className="text-sm text-zinc-500">
                                {isGoalReached 
                                ? "Excelente! Você atingiu sua meta." 
                                : `Você já completou ${Math.min(100, Math.max(0, goalProgress)).toFixed(0)}% do objetivo.`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Categories Chart */}
                <div className={`bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 flex flex-col hover:shadow-lg transition-all hover:border-zinc-200 h-full ${(!settings || period !== 'month') ? 'col-span-2' : ''}`}>
                    <h3 className="text-lg font-bold text-zinc-800 mb-2">Distribuição</h3>
                    <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
                        {dataByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dataByCategory}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {dataByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                                        contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm">Sem dados.</p>
                        )}
                         {dataByCategory.length > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                                <span className="text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Maior</span>
                                <span className="text-sm font-bold text-zinc-800">{dataByCategory[0].name.substring(0, 10)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Potential Savings Card (Moved Here) */}
            <PotentialSavingsCard 
                data={potentialSavings} 
                riskCategories={forecast.riskCategories}
                onViewDetails={onViewSavingsPlan} 
            />

        </div>

        {/* Right Column - History & Forecast */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col hover:shadow-lg transition-all hover:border-zinc-200 lg:h-[568px] h-auto">
            <h3 className="text-xl font-bold text-zinc-800 mb-6 flex items-center gap-2 shrink-0">
                <ArrowDownRight className="text-zinc-400" size={20} />
                Recentes
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                {filteredTransactions.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <Wallet className="text-zinc-400 mb-2 w-10 h-10"/>
                        <p className="text-zinc-400 text-sm">Sem dados no período.</p>
                    </div>
                )}
                {filteredTransactions
                    .sort((a,b) => {
                       const dateA = new Date(a.paymentDate || a.date).getTime();
                       const dateB = new Date(b.paymentDate || b.date).getTime();
                       return dateB - dateA;
                    })
                    .slice(0, 50) 
                    .map(t => {
                        const effectiveDate = t.paymentDate || t.date;
                        const isScheduled = t.paymentDate && t.paymentDate !== t.date && new Date(t.paymentDate) > new Date(t.date);

                        return (
                            <div key={t.id} className="flex justify-between items-center group p-3 hover:bg-zinc-50 rounded-2xl transition-all cursor-default hover:scale-[1.02] active:scale-[0.98]">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors shrink-0 ${t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200' : 'bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200'}`}>
                                        {t.description.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-zinc-800 group-hover:text-emerald-600 transition-colors truncate">{t.description}</p>
                                        <div className="flex items-center gap-1">
                                           <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">{t.category}</p>
                                           {isScheduled && <Clock size={10} className="text-orange-400" />}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 pl-2">
                                    <span className={`text-sm font-bold block ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-800'}`}>
                                        {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-zinc-300">{new Date(effectiveDate).toLocaleDateString('pt-BR', {day: '2-digit', month:'2-digit'})}</span>
                                </div>
                            </div>
                        );
                    })}
            </div>
            
            <button 
                onClick={onViewAllHistory}
                className="w-full mt-6 py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors hover:text-zinc-900 border border-transparent hover:border-zinc-200 shrink-0"
            >
                Ver Extrato Completo
            </button>
            </div>

            {period === 'month' && <ForecastCard forecast={forecast} />}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;