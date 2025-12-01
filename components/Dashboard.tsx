import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, UserSettings, TimePeriod } from '../types';
import { SavingsReview } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Target, Wallet, TrendingDown, ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle, Zap } from 'lucide-react';
import { getMonthName, filterTransactionsByPeriod, projectRecurringTransactions } from '../utils/dateUtils';
import { calculatePotentialSavings } from '../services/savingsService';
import { calculateMonthlyForecast, generateSmartAlerts, SmartAlert } from '../services/forecastService';
import { calculateOverspendProjection } from '../services/budgetService';
import PotentialSavingsCard from './PotentialSavingsCard';
import OverspendProjectionCard from './OverspendProjectionCard';
import { getIconForTransaction } from '../utils/iconMapper';

interface DashboardProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  reviews: SavingsReview[];
  alerts: SmartAlert[];
  onViewAllHistory: () => void; // Navigate to Explore page
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
  // Include projected recurring transactions for the current period
  const projectedTransactions = useMemo(() =>
    projectRecurringTransactions(transactions, currentDate),
    [transactions, currentDate]
  );

  const allTransactions = useMemo(() =>
    [...transactions, ...projectedTransactions],
    [transactions, projectedTransactions]
  );

  const filteredTransactions = filterTransactionsByPeriod(allTransactions, currentDate, period);

  // Calculate Potential Savings
  const potentialSavings = useMemo(() => calculatePotentialSavings(transactions, reviews), [transactions, reviews]);

  // Calculate Forecast
  const forecast = useMemo(() => calculateMonthlyForecast(transactions, currentDate, settings, isTurboMode), [transactions, currentDate, settings, isTurboMode]);

  // Calculate Overspend Projection
  const overspendProjection = useMemo(() => {
    if (!settings) return { willOverspend: false };
    return calculateOverspendProjection(transactions, settings.monthlyIncome, currentDate);
  }, [transactions, settings, currentDate]);
  
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
    <div className="space-y-4 md:space-y-6 animate-fadeIn pb-20">
      
      {/* Header & Date Navigation - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-8 gap-3 md:gap-4">
        <div className="animate-slideUpFade">
           <h2 className="text-2xl md:text-4xl font-light text-zinc-900 tracking-tight">
              Visão Geral
           </h2>
           <p className="text-zinc-500 text-xs md:text-base mt-0.5 md:mt-1">Seu fluxo de caixa</p>
        </div>

        <div className="flex items-center bg-white p-1 md:p-2 rounded-lg md:rounded-2xl shadow-sm border border-zinc-100 shrink-0">
           <button onClick={handlePrevMonth} className="p-1.5 md:p-2 active:bg-zinc-100 md:hover:bg-zinc-100 rounded-md md:rounded-xl transition-colors text-zinc-600">
             <ChevronLeft size={16} className="md:w-5 md:h-5" />
           </button>
           <div className="flex items-center gap-1 md:gap-2 px-1.5 md:px-4 min-w-[80px] md:min-w-[140px] justify-center">
             <Calendar size={12} className="md:w-4 md:h-4 text-emerald-600 hidden sm:block" />
             <span className="font-bold text-xs md:text-base text-zinc-800 capitalize whitespace-nowrap">
                {getMonthName(currentDate)}
             </span>
           </div>
           <button onClick={handleNextMonth} className="p-1.5 md:p-2 active:bg-zinc-100 md:hover:bg-zinc-100 rounded-md md:rounded-xl transition-colors text-zinc-600">
             <ChevronRight size={16} className="md:w-5 md:h-5" />
           </button>
        </div>
      </div>

      {/* Smart Alerts Section - Hidden on mobile, compact on tablet+ */}
      {bodyAlerts.length > 0 && (
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {bodyAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`p-3 rounded-xl border flex items-center gap-2 ${
              alert.type === 'danger' ? 'bg-rose-50 border-rose-100 text-rose-900' :
              alert.type === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-900' :
              'bg-blue-50 border-blue-100 text-blue-900'
            }`}>
              <div className={`p-1.5 rounded-lg shrink-0 ${
                 alert.type === 'danger' ? 'bg-rose-100 text-rose-600' :
                 alert.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                 'bg-blue-100 text-blue-600'
              }`}>
                <AlertTriangle size={14} />
              </div>
              <p className="text-xs font-medium truncate flex-1">{alert.title}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 items-start">

        {/* Left Column - Main Stats & Goals */}
        <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
            
            {/* Top Cards Grid - Mobile: Stack, Desktop: 3 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                {/* Balance Card - Full width on mobile */}
                <div className="sm:col-span-2 md:col-span-1 bg-zinc-900 text-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl md:shadow-2xl flex flex-col justify-between min-h-[140px] md:h-56 relative overflow-hidden group transition-all active:scale-[0.98] shine-effect">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3 md:mb-6">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-400 border border-zinc-700 shadow-md group-hover:shadow-emerald-500/20 transition-shadow">
                                <Wallet size={20} className="md:w-6 md:h-6 animate-subtle-bounce" />
                            </div>
                            <div className="px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] md:text-xs font-medium text-zinc-400">
                                {period === 'month' ? 'Mensal' : 'Anual'}
                            </div>
                        </div>
                        <p className="text-zinc-400 text-xs md:text-sm font-medium mb-0.5 md:mb-1">Saldo Líquido</p>
                        <h3 className="text-lg sm:text-2xl md:text-4xl font-bold tracking-tight truncate animate-countUp">
                          R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    {/* Animated background decor */}
                    <div className="hidden md:block absolute -right-10 -bottom-10 w-48 h-48 bg-zinc-800 rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
                    <div className="hidden md:block absolute -right-5 -bottom-5 w-32 h-32 bg-emerald-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {/* Subtle particle dots */}
                    <div className="absolute top-4 right-4 w-1 h-1 bg-emerald-400/50 rounded-full animate-float-particle"></div>
                    <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-blue-400/30 rounded-full animate-float-particle" style={{ animationDelay: '1s' }}></div>
                </div>

                {/* Income Card */}
                <div className="bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-2 md:gap-4 active:border-emerald-200 md:hover:border-emerald-200 md:hover:shadow-lg md:hover:shadow-emerald-100/50 transition-all duration-300 group min-h-[100px] md:h-56 card-lift relative overflow-hidden">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="p-1.5 md:p-2 bg-emerald-50 rounded-lg md:rounded-xl text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                          <ArrowUpRight size={18} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg">Receitas</span>
                    </div>
                    <div className="min-w-0 overflow-hidden relative z-10">
                        <p className="text-zinc-400 text-xs md:text-sm mb-0.5 md:mb-1">Entradas</p>
                        <p className="text-base sm:text-xl md:text-3xl font-bold text-zinc-900 truncate number-transition">R$ {totalIncome.toLocaleString('pt-BR')}</p>
                    </div>
                    {/* Subtle gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/50 group-hover:to-emerald-100/30 transition-all duration-500 pointer-events-none"></div>
                </div>

                {/* Expense Card */}
                <div className="bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-2 md:gap-4 active:border-rose-200 md:hover:border-rose-200 md:hover:shadow-lg md:hover:shadow-rose-100/50 transition-all duration-300 group min-h-[100px] md:h-56 card-lift relative overflow-hidden">
                    <div className="flex items-center justify-between relative z-10">
                         <div className="p-1.5 md:p-2 bg-rose-50 rounded-lg md:rounded-xl text-rose-600 group-hover:bg-rose-100 transition-colors">
                           <TrendingDown size={18} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                         </div>
                         <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg">Despesas</span>
                    </div>
                    <div className="min-w-0 overflow-hidden relative z-10">
                        <p className="text-zinc-400 text-xs md:text-sm mb-0.5 md:mb-1">Saídas</p>
                        <p className="text-base sm:text-xl md:text-3xl font-bold text-zinc-900 truncate number-transition">R$ {totalExpense.toLocaleString('pt-BR')}</p>
                    </div>
                    {/* Subtle gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-50/0 to-rose-100/0 group-hover:from-rose-50/50 group-hover:to-rose-100/30 transition-all duration-500 pointer-events-none"></div>
                </div>
            </div>

            {/* Charts & Goals Row - Responsive height */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 md:h-80">
                {/* Goal Widget */}
                {settings && period === 'month' && (
                    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm border border-zinc-100 relative overflow-hidden flex flex-col justify-center transition-all h-auto md:h-full group ${isGoalReached ? 'animate-gentle-pulse' : ''}`}>
                        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-6 relative z-10">
                            <div className={`p-1.5 md:p-2 rounded-lg transition-colors ${isGoalReached ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                <Target size={16} className={`md:w-5 md:h-5 ${isGoalReached ? 'animate-subtle-bounce' : ''}`} />
                            </div>
                            <h3 className="font-bold text-zinc-800 text-sm md:text-lg">Meta Mensal</h3>
                            {isGoalReached && (
                              <span className="ml-auto text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full animate-scaleIn">
                                🎉 Atingida!
                              </span>
                            )}
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-2 gap-2">
                                <span className={`text-base sm:text-xl md:text-3xl font-bold truncate min-w-0 number-transition ${isGoalReached ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                    R$ {Math.max(0, savings).toLocaleString('pt-BR')}
                                </span>
                                <span className="text-zinc-400 font-medium text-[10px] md:text-sm mb-0.5 md:mb-1 shrink-0">/ R$ {settings.savingsGoal.toLocaleString('pt-BR')}</span>
                            </div>

                            <div className="w-full bg-zinc-100 rounded-full h-2.5 md:h-4 mb-2 md:mb-3 overflow-hidden relative">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isGoalReached ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-zinc-800'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, goalProgress))}%` }}
                                ></div>
                                {/* Shimmer effect on progress bar */}
                                <div className="absolute inset-0 animate-shimmer opacity-30"></div>
                            </div>
                            
                            <p className="text-sm text-zinc-500">
                                {isGoalReached 
                                ? "Excelente! Você atingiu sua meta." 
                                : `Você já completou ${Math.min(100, Math.max(0, goalProgress)).toFixed(0)}% do objetivo.`}
                            </p>
                        </div>
                        
                        {/* Celebration particles when goal reached */}
                        {isGoalReached && (
                          <>
                            <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full animate-float-particle opacity-60"></div>
                            <div className="absolute top-4 right-8 w-1.5 h-1.5 bg-blue-400 rounded-full animate-float-particle opacity-60" style={{ animationDelay: '0.5s' }}></div>
                            <div className="absolute bottom-4 left-4 w-1 h-1 bg-purple-400 rounded-full animate-float-particle opacity-60" style={{ animationDelay: '1s' }}></div>
                          </>
                        )}
                    </div>
                )}

                {/* Categories Chart */}
                <div className={`bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-100 flex flex-col transition-all h-auto md:h-full ${(!settings || period !== 'month') ? 'col-span-1 md:col-span-2' : ''}`}>
                    <h3 className="text-sm md:text-lg font-bold text-zinc-800 mb-2 md:mb-4">Distribuição por Categoria</h3>
                    <div className="flex-1 flex items-center justify-center relative min-h-[150px] md:min-h-[250px]">
                        {dataByCategory.length > 0 ? (
                            <>
                            {/* Mobile Chart */}
                            <div className="md:hidden w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dataByCategory}
                                            innerRadius={40}
                                            outerRadius={60}
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
                                            contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Desktop Chart */}
                            <div className="hidden md:block w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dataByCategory}
                                            innerRadius={70}
                                            outerRadius={100}
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
                                            contentStyle={{ background: '#18181b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            </>
                        ) : (
                            <p className="text-zinc-400 text-xs md:text-sm">Sem dados.</p>
                        )}
                         {dataByCategory.length > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                                <span className="text-[8px] md:text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Maior</span>
                                <span className="text-xs md:text-base font-bold text-zinc-800">{dataByCategory[0].name.substring(0, 10)}</span>
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

            {period === 'month' && settings && (
              <OverspendProjectionCard
                projection={overspendProjection}
                monthlyIncome={settings.monthlyIncome}
              />
            )}

        </div>

        {/* Right Column - History & Forecast */}
        <div className="lg:col-span-1 flex flex-col gap-4 md:gap-6">
            <div className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-100 flex flex-col transition-all lg:h-[568px] h-auto max-h-[400px] lg:max-h-none">
            <h3 className="text-base md:text-xl font-bold text-zinc-800 mb-3 md:mb-6 flex items-center gap-2 shrink-0">
                <ArrowDownRight className="text-zinc-400 animate-subtle-bounce" size={16} />
                Recentes
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 md:space-y-4 pr-1 md:pr-2 scrollbar-hide">
                {filteredTransactions.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-8">
                        <Wallet className="text-zinc-400 mb-2 w-8 h-8 md:w-10 md:h-10"/>
                        <p className="text-zinc-400 text-xs md:text-sm">Sem dados no período.</p>
                    </div>
                )}
                {filteredTransactions
                    .sort((a,b) => {
                       const dateA = new Date(a.paymentDate || a.date).getTime();
                       const dateB = new Date(b.paymentDate || b.date).getTime();
                       return dateB - dateA;
                    })
                    .slice(0, 8) 
                    .map(t => {
                        const effectiveDate = t.paymentDate || t.date;
                        const isScheduled = t.paymentDate && t.paymentDate !== t.date && new Date(t.paymentDate) > new Date(t.date);

                        const iconConfig = getIconForTransaction(t.description, t.category);
                        const IconComponent = iconConfig.icon;
                        
                        return (
                            <div key={t.id} className="flex justify-between items-center gap-2 md:gap-3 group p-2 md:p-3 active:bg-zinc-50 md:hover:bg-zinc-50/80 rounded-xl md:rounded-2xl transition-all cursor-default active:scale-[0.98] md:hover:shadow-sm animate-slideUpFade" style={{ animationDelay: `${0.05}s` }}>
                                <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0 group-hover:scale-105 ${t.type === TransactionType.INCOME ? 'bg-emerald-100 group-hover:bg-emerald-200' : iconConfig.bgColor}`}>
                                        <IconComponent size={16} className={`md:w-5 md:h-5 transition-transform group-hover:scale-110 ${t.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs md:text-sm font-bold text-zinc-800 transition-colors truncate group-hover:text-zinc-900" title={t.description}>{t.description}</p>
                                        <div className="flex items-center gap-1">
                                           <p className="text-[9px] md:text-[10px] text-zinc-400 uppercase tracking-wide font-medium truncate">{t.category}</p>
                                           {isScheduled && <Clock size={8} className="md:w-2.5 md:h-2.5 text-orange-400 shrink-0 animate-subtle-bounce" />}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`text-xs md:text-sm font-bold block whitespace-nowrap number-transition ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-800'}`}>
                                        {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[9px] md:text-[10px] text-zinc-300">{new Date(effectiveDate).toLocaleDateString('pt-BR', {day: '2-digit', month:'2-digit'})}</span>
                                </div>
                            </div>
                        );
                    })}
            </div>
            
            <button
                onClick={onViewAllHistory}
                className="w-full mt-4 md:mt-6 py-2.5 md:py-3 text-xs md:text-sm font-bold text-zinc-500 active:bg-zinc-50 md:hover:bg-zinc-50 rounded-lg md:rounded-xl transition-all active:text-zinc-900 md:hover:text-zinc-900 border border-zinc-200 md:border-transparent md:hover:border-zinc-200 shrink-0 group animated-underline"
            >
                <span className="group-hover:translate-x-1 inline-block transition-transform">Ver Extrato Completo →</span>
            </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
