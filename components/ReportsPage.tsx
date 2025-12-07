import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category, UserSettings } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, DollarSign, CreditCard, Repeat, Package, AlertTriangle, Download, ChevronRight, Target, EyeOff, Eye, Activity, Award, Zap } from 'lucide-react';
import { getMonthName, projectRecurringTransactions } from '../utils/dateUtils';

interface ReportsPageProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  onUpdateTransaction?: (transaction: Transaction) => void;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ transactions, settings, onUpdateTransaction }) => {
  const [selectedSection, setSelectedSection] = useState<'overview' | 'subscriptions' | 'installments' | 'budgets'>('overview');
  const [timeHorizon, setTimeHorizon] = useState<3 | 6 | 12>(6);

  // Toggle subscription visibility in analysis
  const toggleSubscriptionVisibility = (transaction: Transaction) => {
    if (!onUpdateTransaction) return;

    const currentTags = transaction.tags || [];
    const hasExcludeTag = currentTags.includes('excluir-assinatura');

    const updatedTransaction = {
      ...transaction,
      tags: hasExcludeTag
        ? currentTags.filter(tag => tag !== 'excluir-assinatura')
        : [...currentTags, 'excluir-assinatura']
    };

    onUpdateTransaction(updatedTransaction);
  };

  // Calculate monthly data for trends
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expense: number; balance: number; date: Date }> = {};
    const now = new Date();
    const maxFutureDate = new Date(now.getFullYear(), now.getMonth() + 12, 1); // Max 12 months in future

    // Project recurring transactions into current and upcoming months so the month-by-month
    // view reflects everything that will hit cash flow (agenda items).
    // IMPORTANT: Start from i=0 to include the CURRENT month, not just future months.
    // This ensures recurring income (like salary) and recurring expenses are properly
    // reflected in the current month's totals.
    const projectedRecurring: Transaction[] = [];
    for (let i = 0; i <= timeHorizon; i++) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      projectedRecurring.push(...projectRecurringTransactions(transactions, targetMonth));
    }

    [...transactions, ...projectedRecurring]
      .filter(t => {
        if (t.isReimbursable) return false;

        // Filter out transactions too far in the future (likely data entry errors)
        const date = new Date(t.paymentDate || t.date);
        return date <= maxFutureDate;
      })
      .forEach(t => {
        const date = new Date(t.paymentDate || t.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!data[monthKey]) {
          data[monthKey] = {
            month: monthKey,
            income: 0,
            expense: 0,
            balance: 0,
            date
          };
        }

        if (t.type === TransactionType.INCOME) {
          data[monthKey].income += t.amount;
        } else {
          data[monthKey].expense += t.amount;
        }
      });

    // Calculate balance and sort by date
    // For the time horizon filter, we want to show the LAST N months from today's perspective
    const sortedData = Object.values(data)
      .map(d => ({
        ...d,
        balance: d.income - d.expense
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Get current month index
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentIndex = sortedData.findIndex(d => d.month === currentMonthKey);

    // If current month exists, slice from (currentIndex - timeHorizon + 1) to (currentIndex + 1)
    // This ensures we show the last N months INCLUDING current month
    if (currentIndex >= 0) {
      const startIndex = Math.max(0, currentIndex - timeHorizon + 1);
      return sortedData.slice(startIndex, currentIndex + 1);
    }

    // Fallback: just take last N months
    return sortedData.slice(-timeHorizon);
  }, [transactions, timeHorizon]);

  // Financial Health Score (0-100)
  const financialHealthScore = useMemo(() => {
    if (monthlyData.length === 0 || !settings?.monthlyIncome) return 0;

    const currentMonth = monthlyData[monthlyData.length - 1];
    let score = 0;

    // 1. Savings Rate (40 points max)
    const savingsRate = currentMonth.income > 0 ? (currentMonth.balance / currentMonth.income) * 100 : 0;
    if (savingsRate >= 30) score += 40;
    else if (savingsRate >= 20) score += 30;
    else if (savingsRate >= 10) score += 20;
    else if (savingsRate >= 0) score += 10;

    // 2. Expense Consistency (30 points max)
    if (monthlyData.length >= 3) {
      const expenses = monthlyData.map(m => m.expense);
      const avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
      const variance = expenses.reduce((sum, exp) => sum + Math.pow(exp - avgExpense, 2), 0) / expenses.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avgExpense > 0 ? (stdDev / avgExpense) * 100 : 100;

      if (coefficientOfVariation < 10) score += 30;
      else if (coefficientOfVariation < 20) score += 20;
      else if (coefficientOfVariation < 30) score += 10;
    }

    // 3. Income vs Expenses Balance (30 points max)
    const expenseRatio = currentMonth.income > 0 ? (currentMonth.expense / currentMonth.income) * 100 : 100;
    if (expenseRatio < 70) score += 30;
    else if (expenseRatio < 80) score += 20;
    else if (expenseRatio < 90) score += 10;

    return Math.min(100, Math.round(score));
  }, [monthlyData, settings]);

  // Heatmap data: expenses by day of week and week of month
  const heatmapData = useMemo(() => {
    const heatmap: Record<string, Record<number, number>> = {
      'Dom': {},
      'Seg': {},
      'Ter': {},
      'Qua': {},
      'Qui': {},
      'Sex': {},
      'Sáb': {}
    };

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    transactions
      .filter(t => t.type === TransactionType.EXPENSE && !t.isProjected && !t.isReimbursable)
      .forEach(t => {
        const date = new Date(t.paymentDate || t.date);
        const dayOfWeek = daysOfWeek[date.getDay()];
        const dayOfMonth = date.getDate();

        // Group by weeks: 1-7, 8-14, 15-21, 22-31
        const weekNumber = Math.ceil(dayOfMonth / 7);

        if (!heatmap[dayOfWeek][weekNumber]) {
          heatmap[dayOfWeek][weekNumber] = 0;
        }
        heatmap[dayOfWeek][weekNumber] += t.amount;
      });

    // Convert to array format for rendering
    const result = [];
    for (let week = 1; week <= 4; week++) {
      for (const day of daysOfWeek) {
        result.push({
          day,
          week: `Semana ${week}`,
          weekNum: week,
          amount: heatmap[day][week] || 0
        });
      }
    }

    return result;
  }, [transactions]);

  // Get max value for heatmap color scaling
  const heatmapMax = useMemo(() => {
    return Math.max(...heatmapData.map(d => d.amount), 1);
  }, [heatmapData]);

  // Top 10 largest individual expenses
  const topExpenses = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - timeHorizon, 1);

    return transactions
      .filter(t => {
        if (t.type !== TransactionType.EXPENSE || t.isProjected || t.isReimbursable) return false;
        const date = new Date(t.paymentDate || t.date);
        return date >= cutoffDate;
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [transactions, timeHorizon]);

  // Net Worth Evolution (Patrimônio Líquido Acumulado)
  const netWorthEvolution = useMemo(() => {
    // Calculate cumulative balance over time
    let cumulativeBalance = 0;

    return monthlyData.map(month => {
      cumulativeBalance += month.balance;
      return {
        ...month,
        netWorth: cumulativeBalance
      };
    });
  }, [monthlyData]);

  // Calculate percentage changes
  const getCurrentVsPrevious = () => {
    if (monthlyData.length < 2) return { incomeChange: 0, expenseChange: 0, balanceChange: 0 };

    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    return {
      incomeChange: previous.income > 0 ? ((current.income - previous.income) / previous.income) * 100 : 0,
      expenseChange: previous.expense > 0 ? ((current.expense - previous.expense) / previous.expense) * 100 : 0,
      balanceChange: previous.balance !== 0 ? ((current.balance - previous.balance) / previous.balance) * 100 : 0
    };
  };

  const changes = getCurrentVsPrevious();

  // Category ranking
  const categoryRanking = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const currentData: Record<string, number> = {};
    const prevData: Record<string, number> = {};

    transactions
      .filter(t => t.type === TransactionType.EXPENSE && !t.isProjected && !t.isReimbursable)
      .forEach(t => {
        const date = new Date(t.paymentDate || t.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (monthKey === currentMonth) {
          currentData[t.category] = (currentData[t.category] || 0) + t.amount;
        } else if (monthKey === prevMonthKey) {
          prevData[t.category] = (prevData[t.category] || 0) + t.amount;
        }
      });

    return Object.entries(currentData)
      .map(([category, amount]) => ({
        category,
        amount,
        previousAmount: prevData[category] || 0,
        change: prevData[category] ? ((amount - prevData[category]) / prevData[category]) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [transactions]);

  // Categories that should be excluded from subscriptions (essentials)
  const ESSENTIAL_CATEGORIES = [
    Category.HOUSING, // Moradia
    Category.UTILITIES, // Contas (água, luz, etc)
    Category.SALARY
  ];

  // Recurring transactions analysis
  const subscriptionsData = useMemo(() => {
    const recurring = transactions.filter(t =>
      t.isRecurring &&
      t.type === TransactionType.EXPENSE &&
      !t.isProjected &&
      !ESSENTIAL_CATEGORIES.includes(t.category) && // Exclude essentials
      !t.tags?.includes('excluir-assinatura') // Allow manual exclusion via tag
    );

    // Calculate historical averages (last 3 months)
    const historicalData: Record<string, number[]> = {};
    const now = new Date();

    recurring.forEach(t => {
      const date = new Date(t.paymentDate || t.date);
      const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

      if (monthsAgo <= 3) {
        if (!historicalData[t.description]) {
          historicalData[t.description] = [];
        }
        historicalData[t.description].push(t.amount);
      }
    });

    // Group by description and get latest
    const grouped: Record<string, Transaction> = {};
    recurring.forEach(t => {
      if (!grouped[t.description] || new Date(t.date) > new Date(grouped[t.description].date)) {
        grouped[t.description] = t;
      }
    });

    return Object.values(grouped).map(t => {
      const amounts = historicalData[t.description] || [t.amount];
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const priceIncrease = amounts.length > 1 ? ((t.amount - amounts[0]) / amounts[0]) * 100 : 0;

      return {
        ...t,
        avgAmount,
        priceIncrease,
        annualCost: t.amount * 12,
        nextCharge: new Date(new Date(t.date).setMonth(new Date(t.date).getMonth() + 1)).toISOString()
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const subscriptionStats = {
    total: subscriptionsData.reduce((sum, s) => sum + s.amount, 0),
    annualTotal: subscriptionsData.reduce((sum, s) => sum + s.annualCost, 0),
    count: subscriptionsData.length,
    percentageOfIncome: settings?.monthlyIncome ? (subscriptionsData.reduce((sum, s) => sum + s.amount, 0) / settings.monthlyIncome) * 100 : 0
  };

  // Excluded subscriptions (ignored from analysis)
  const excludedSubscriptions = useMemo(() => {
    const recurring = transactions.filter(t =>
      t.isRecurring &&
      t.type === TransactionType.EXPENSE &&
      !t.isProjected &&
      !ESSENTIAL_CATEGORIES.includes(t.category) &&
      t.tags?.includes('excluir-assinatura') // Only excluded ones
    );

    // Group by description and get latest
    const grouped: Record<string, Transaction> = {};
    recurring.forEach(t => {
      if (!grouped[t.description] || new Date(t.date) > new Date(grouped[t.description].date)) {
        grouped[t.description] = t;
      }
    });

    return Object.values(grouped).map(t => ({
      ...t,
      annualCost: t.amount * 12
    })).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Installments analysis
  const installmentsData = useMemo(() => {
    const installments = transactions.filter(t =>
      /\((\d+)\/(\d+)\)/.test(t.description) &&
      t.type === TransactionType.EXPENSE
    );

    // Group by base description (without installment part)
    const grouped: Record<string, Transaction[]> = {};

    installments.forEach(t => {
      const baseDesc = t.description.replace(/\s*\(\d+\/\d+\)/, '');
      if (!grouped[baseDesc]) {
        grouped[baseDesc] = [];
      }
      grouped[baseDesc].push(t);
    });

    return Object.entries(grouped).map(([baseDesc, items]) => {
      const match = items[0].description.match(/\((\d+)\/(\d+)\)/);
      const totalInstallments = match ? parseInt(match[2]) : items.length;
      const paid = items.filter(i => new Date(i.paymentDate || i.date) <= new Date()).length;
      const remaining = totalInstallments - paid;
      const totalAmount = items[0].amount * totalInstallments;
      const paidAmount = items[0].amount * paid;
      const progress = (paid / totalInstallments) * 100;

      // Get future installments
      const futureInstallments = items
        .filter(i => new Date(i.paymentDate || i.date) > new Date())
        .sort((a, b) => new Date(a.paymentDate || a.date).getTime() - new Date(b.paymentDate || b.date).getTime());

      // Check if any installment is reimbursable (third-party purchase)
      const reimbursedBy = items[0].reimbursedBy;

      return {
        description: baseDesc,
        amount: items[0].amount,
        totalInstallments,
        paid,
        remaining,
        totalAmount,
        paidAmount,
        progress,
        issuer: items[0].issuer || items[0].creditCardIssuer,
        futureInstallments,
        reimbursedBy
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions]);

  const installmentsStats = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = now.getFullYear();

    const installmentTransactions = transactions.filter(t =>
      /\(\d+\/\d+\)/.test(t.description) &&
      t.type === TransactionType.EXPENSE
    );

    const monthlyTotal = installmentTransactions.reduce((sum, t) => {
      const date = new Date(t.paymentDate || t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === currentMonthKey ? sum + t.amount : sum;
    }, 0);

    const annualTotal = installmentTransactions.reduce((sum, t) => {
      const date = new Date(t.paymentDate || t.date);
      return date.getFullYear() === currentYear ? sum + t.amount : sum;
    }, 0);

    const activeCount = installmentsData.filter(item => item.remaining > 0).length;

    const percentageOfIncome = settings?.monthlyIncome
      ? (monthlyTotal / settings.monthlyIncome) * 100
      : 0;

    return {
      monthlyTotal,
      annualTotal,
      activeCount,
      percentageOfIncome
    };
  }, [transactions, installmentsData, settings]);

  // Monthly installment projections
  const monthlyInstallmentProjections = useMemo(() => {
    const projections: Record<string, { month: string; total: number; byCard: Record<string, number> }> = {};

    installmentsData.forEach(item => {
      item.futureInstallments.forEach(inst => {
        const date = new Date(inst.paymentDate || inst.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!projections[monthKey]) {
          projections[monthKey] = {
            month: monthKey,
            total: 0,
            byCard: {}
          };
        }

        projections[monthKey].total += inst.amount;

        const card = inst.issuer || inst.creditCardIssuer || 'Outros';
        projections[monthKey].byCard[card] = (projections[monthKey].byCard[card] || 0) + inst.amount;
      });
    });

    return Object.values(projections)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, 12);
  }, [installmentsData]);

  // Card comparison
  const cardComparison = useMemo(() => {
    const cards: Record<string, { total: number; count: number; projected: number }> = {};

    transactions
      .filter(t => t.type === TransactionType.EXPENSE && (t.issuer || t.creditCardIssuer))
      .forEach(t => {
        const card = t.issuer || t.creditCardIssuer || 'Outros';
        const date = new Date(t.paymentDate || t.date);
        const now = new Date();

        if (!cards[card]) {
          cards[card] = { total: 0, count: 0, projected: 0 };
        }

        cards[card].total += t.amount;
        cards[card].count += 1;

        // Project future based on recurring and installments
        if (t.isRecurring) {
          cards[card].projected += t.amount;
        }
        if (/\(\d+\/\d+\)/.test(t.description) && date > now) {
          cards[card].projected += t.amount;
        }
      });

    return Object.entries(cards)
      .map(([card, data]) => ({
        card,
        ...data
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Free balance projection
  const freeBalanceProjection = useMemo(() => {
    const projections = [];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`;

      let income = settings?.monthlyIncome || 0;
      let expenses = 0;

      // Project recurring expenses for this specific month
      const projectedRecurring = projectRecurringTransactions(transactions, targetMonth);

      // Get unique recurring expenses (avoid duplicates from historical data)
      const recurringExpensesForMonth = new Map<string, number>();

      // Add real recurring transactions that exist in this month
      transactions
        .filter(t => {
          if (!t.isRecurring || t.type !== TransactionType.EXPENSE || t.isProjected) return false;
          const date = new Date(t.paymentDate || t.date);
          return date.getFullYear() === targetMonth.getFullYear() &&
                 date.getMonth() === targetMonth.getMonth();
        })
        .forEach(t => {
          recurringExpensesForMonth.set(t.description, t.amount);
        });

      // Add projected recurring transactions for future months
      projectedRecurring
        .filter(t => t.type === TransactionType.EXPENSE)
        .forEach(t => {
          if (!recurringExpensesForMonth.has(t.description)) {
            recurringExpensesForMonth.set(t.description, t.amount);
          }
        });

      // Sum all unique recurring expenses
      recurringExpensesForMonth.forEach(amount => {
        expenses += amount;
      });

      // Count installments for this month
      transactions
        .filter(t => {
          if (!/\(\d+\/\d+\)/.test(t.description)) return false;
          const date = new Date(t.paymentDate || t.date);
          return date.getFullYear() === targetMonth.getFullYear() &&
                 date.getMonth() === targetMonth.getMonth();
        })
        .forEach(t => {
          expenses += t.amount;
        });

      projections.push({
        month: monthKey,
        monthName: getMonthName(targetMonth).substring(0, 3),
        income,
        expenses,
        freeBalance: income - expenses
      });
    }

    return projections;
  }, [transactions, settings]);

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <div className="animate-fadeIn pb-20">
      <div className="mb-6">
        <h2 className="text-3xl font-light text-zinc-800 mb-2">Relatórios</h2>
        <p className="text-zinc-500 text-sm">Análises, tendências e projeções financeiras</p>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedSection('overview')}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            selectedSection === 'overview'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
          }`}
        >
          <TrendingUp size={16} className="inline mr-2" />
          Visão Geral
        </button>
        <button
          onClick={() => setSelectedSection('subscriptions')}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            selectedSection === 'subscriptions'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
          }`}
        >
          <Repeat size={16} className="inline mr-2" />
          Assinaturas
        </button>
        <button
          onClick={() => setSelectedSection('installments')}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            selectedSection === 'installments'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
          }`}
        >
          <Package size={16} className="inline mr-2" />
          Parcelas
        </button>
        <button
          onClick={() => setSelectedSection('budgets')}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            selectedSection === 'budgets'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
          }`}
        >
          <Target size={16} className="inline mr-2" />
          Metas
        </button>
      </div>

      {/* Overview Section */}
      {selectedSection === 'overview' && (
        <div className="space-y-6">
          {/* Time Horizon Selector */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-800">Período de Análise</h3>
              <div className="flex gap-2">
                {[3, 6, 12].map(months => (
                  <button
                    key={months}
                    onClick={() => setTimeHorizon(months as 3 | 6 | 12)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      timeHorizon === months
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {months} meses
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Health Score - Featured */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl shadow-xl p-8 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Activity size={28} />
                  Saúde Financeira
                </h3>
                <p className="text-emerald-50 text-sm">Baseado em taxa de poupança, consistência e equilíbrio</p>
              </div>
              <div className="text-center">
                <div className="relative inline-block">
                  <svg className="transform -rotate-90" width="120" height="120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="white"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${(financialHealthScore / 100) * 314} 314`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold">{financialHealthScore}</span>
                  </div>
                </div>
                <p className="text-xs text-emerald-50 mt-2">
                  {financialHealthScore >= 80 ? 'Excelente' : financialHealthScore >= 60 ? 'Bom' : financialHealthScore >= 40 ? 'Regular' : 'Precisa melhorar'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-xs text-emerald-50 mb-1">Taxa de Poupança</p>
                <p className="text-xl font-bold">
                  {monthlyData.length > 0 && monthlyData[monthlyData.length - 1].income > 0
                    ? ((monthlyData[monthlyData.length - 1].balance / monthlyData[monthlyData.length - 1].income) * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-xs text-emerald-50 mb-1">Gastos vs Renda</p>
                <p className="text-xl font-bold">
                  {monthlyData.length > 0 && monthlyData[monthlyData.length - 1].income > 0
                    ? ((monthlyData[monthlyData.length - 1].expense / monthlyData[monthlyData.length - 1].income) * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-xs text-emerald-50 mb-1">Saldo Médio</p>
                <p className="text-xl font-bold">
                  R$ {monthlyData.length > 0
                    ? (monthlyData.reduce((sum, m) => sum + m.balance, 0) / monthlyData.length).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                    : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Receita (Mês Atual)</span>
                <div className={`flex items-center gap-1 text-xs font-bold ${
                  changes.incomeChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {changes.incomeChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(changes.incomeChange).toFixed(1)}%
                </div>
              </div>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {(monthlyData[monthlyData.length - 1]?.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Média {timeHorizon}m: R$ {(monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Despesas (Mês Atual)</span>
                <div className={`flex items-center gap-1 text-xs font-bold ${
                  changes.expenseChange <= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {changes.expenseChange <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {Math.abs(changes.expenseChange).toFixed(1)}%
                </div>
              </div>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {(monthlyData[monthlyData.length - 1]?.expense || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Média {timeHorizon}m: R$ {(monthlyData.reduce((sum, m) => sum + m.expense, 0) / monthlyData.length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Saldo Livre (Mês Atual)</span>
                <div className={`flex items-center gap-1 text-xs font-bold ${
                  changes.balanceChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {changes.balanceChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(changes.balanceChange).toFixed(1)}%
                </div>
              </div>
              <p className={`text-2xl font-bold ${
                (monthlyData[monthlyData.length - 1]?.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                R$ {(monthlyData[monthlyData.length - 1]?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Média {timeHorizon}m: R$ {(monthlyData.reduce((sum, m) => sum + m.balance, 0) / monthlyData.length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Charts Row: Trend + Net Worth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <h3 className="text-lg font-bold text-zinc-800 mb-4">Comparação Mês a Mês</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [, month] = value.split('-');
                      return `${month}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Receita" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Despesa" />
                  <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Net Worth Evolution */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <h3 className="text-lg font-bold text-zinc-800 mb-4">Evolução do Patrimônio Líquido</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={netWorthEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [, month] = value.split('-');
                      return `${month}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    name="Patrimônio Acumulado"
                    dot={{ fill: '#8b5cf6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-purple-50 rounded-xl">
                <p className="text-sm text-purple-900 font-medium">
                  Patrimônio atual: <span className="text-lg font-bold">
                    R$ {(netWorthEvolution[netWorthEvolution.length - 1]?.netWorth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Heatmap de Gastos */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Heatmap de Gastos por Dia da Semana</h3>
            <p className="text-sm text-zinc-500 mb-4">Identifique padrões de consumo ao longo do mês</p>
            <div className="overflow-x-auto overflow-y-hidden">
              <div className="grid grid-cols-7 gap-2 min-w-[600px] p-1">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-zinc-700 mb-2">
                    {day}
                  </div>
                ))}
                {heatmapData.map((cell, idx) => {
                  const intensity = cell.amount / heatmapMax;

                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:brightness-110 hover:shadow-lg cursor-pointer ${
                        cell.amount === 0
                          ? 'bg-zinc-50 text-zinc-300'
                          : intensity > 0.7
                            ? 'bg-rose-500 text-white'
                            : intensity > 0.5
                              ? 'bg-rose-400 text-white'
                              : intensity > 0.3
                                ? 'bg-rose-300 text-rose-900'
                                : intensity > 0.1
                                  ? 'bg-rose-200 text-rose-900'
                                  : 'bg-rose-100 text-rose-800'
                      }`}
                      title={`${cell.day} - ${cell.week}: R$ ${cell.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    >
                      {cell.amount > 0 ? `${(cell.amount / 1000).toFixed(1)}k` : '-'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top 10 Maiores Gastos */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <Zap className="text-rose-500" size={24} />
              Top 10 Maiores Gastos do Período
            </h3>
            <div className="space-y-2">
              {topExpenses.map((expense, idx) => (
                <div key={expense.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-zinc-50 to-white rounded-xl hover:shadow-md transition-all border border-zinc-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg' :
                      idx === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-white shadow-md' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white shadow-md' :
                      'bg-zinc-100 text-zinc-700'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-800">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500">
                          {new Date(expense.paymentDate || expense.date).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full font-medium">
                          {expense.category}
                        </span>
                        {expense.issuer && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {expense.issuer}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-xl text-rose-600">
                    R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Ranking with Trends */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Análise de Tendências por Categoria</h3>
            <div className="space-y-3">
              {categoryRanking.map((cat, idx) => (
                <div key={cat.category} className="p-4 bg-zinc-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">{cat.category}</p>
                        <p className="text-xs text-zinc-500">
                          Mês anterior: R$ {cat.previousAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-zinc-900">
                        R$ {cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <div className={`text-xs font-bold flex items-center gap-1 justify-end ${
                        cat.change <= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {cat.change <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {Math.abs(cat.change).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {/* Visual trend indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.change <= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, (cat.amount / categoryRanking[0].amount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 font-medium w-12 text-right">
                      {((cat.amount / categoryRanking[0].amount) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Section */}
      {selectedSection === 'subscriptions' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Total Mensal</p>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {subscriptionStats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Total Anual</p>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {subscriptionStats.annualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Assinaturas Ativas</p>
              <p className="text-2xl font-bold text-zinc-800">{subscriptionStats.count}</p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">% da Renda</p>
              <p className="text-2xl font-bold text-zinc-800">
                {subscriptionStats.percentageOfIncome.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-800">Detalhamento de Assinaturas</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {subscriptionsData.map(sub => (
                <div key={sub.id} className="p-6 hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-zinc-800">{sub.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Próxima cobrança: {new Date(sub.nextCharge).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg text-zinc-900">
                        R$ {sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </p>
                      {onUpdateTransaction && (
                        <button
                          onClick={() => toggleSubscriptionVisibility(sub)}
                          className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Remover da análise"
                        >
                          <EyeOff size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 text-xs">Média 3 meses</p>
                      <p className="font-medium text-zinc-700">
                        R$ {sub.avgAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Custo Anual</p>
                      <p className="font-medium text-zinc-700">
                        R$ {sub.annualCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Variação</p>
                      <p className={`font-medium ${
                        sub.priceIncrease > 0 ? 'text-rose-600' : sub.priceIncrease < 0 ? 'text-emerald-600' : 'text-zinc-700'
                      }`}>
                        {sub.priceIncrease > 0 ? '+' : ''}{sub.priceIncrease.toFixed(1)}%
                        {Math.abs(sub.priceIncrease) > 10 && (
                          <AlertTriangle size={14} className="inline ml-1 text-orange-500" />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Excluded Subscriptions */}
          {excludedSubscriptions.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                  <EyeOff size={20} className="text-zinc-400" />
                  Assinaturas Ignoradas ({excludedSubscriptions.length})
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Estas assinaturas foram excluídas da análise e não afetam os totais acima
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {excludedSubscriptions.map(sub => (
                  <div key={sub.id} className="p-6 bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-zinc-600">{sub.description}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          R$ {sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                        </p>
                      </div>
                      {onUpdateTransaction && (
                        <button
                          onClick={() => toggleSubscriptionVisibility(sub)}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Restaurar para análise"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Installments Section */}
      {selectedSection === 'installments' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Total Mensal</p>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {installmentsStats.monthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Total Anual</p>
              <p className="text-2xl font-bold text-zinc-800">
                R$ {installmentsStats.annualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">Parcelamentos Ativos</p>
              <p className="text-2xl font-bold text-zinc-800">{installmentsStats.activeCount}</p>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
              <p className="text-sm text-zinc-500 mb-2">% da Renda</p>
              <p className="text-2xl font-bold text-zinc-800">
                {installmentsStats.percentageOfIncome.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Cronograma de Parcelas (12 meses)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyInstallmentProjections}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const [, month] = value.split('-');
                    return month;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="total" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Progress List */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-800">Progresso das Compras Parceladas</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {installmentsData.map(item => (
                <div key={item.description} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-zinc-800">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-zinc-500">
                          {item.issuer && `${item.issuer} • `}
                          {item.paid}/{item.totalInstallments} pagas
                        </p>
                        {item.reimbursedBy && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                            💰 {item.reimbursedBy}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-zinc-900">
                        R$ {item.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-zinc-500">
                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Progresso</span>
                      <span className="font-bold">{item.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 text-xs">Já Pago</p>
                      <p className="font-medium text-emerald-600">
                        R$ {item.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Restante</p>
                      <p className="font-medium text-zinc-700">
                        R$ {(item.totalAmount - item.paidAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Budgets Section - Placeholder */}
      {selectedSection === 'budgets' && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-12 text-center">
          <Target size={48} className="mx-auto text-zinc-300 mb-4" />
          <h3 className="text-xl font-bold text-zinc-800 mb-2">Metas e Orçamento</h3>
          <p className="text-zinc-500">
            Configure limites por categoria e acompanhe seu progresso mensal
          </p>
          <p className="text-sm text-zinc-400 mt-4">Em breve: execução por categoria, alertas e previsões</p>
        </div>
      )}

      {/* Export Button */}
      <div className="fixed bottom-24 right-8 z-30">
        <button
          className="p-4 bg-zinc-900 text-white rounded-full shadow-2xl hover:bg-zinc-700 transition-all hover:scale-110 active:scale-95"
          title="Exportar Relatório (em breve)"
        >
          <Download size={24} />
        </button>
      </div>
    </div>
  );
};

export default ReportsPage;
