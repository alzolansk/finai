import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category, UserSettings } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, DollarSign, CreditCard, Repeat, Package, AlertTriangle, Download, ChevronRight, Target } from 'lucide-react';
import { getMonthName } from '../utils/dateUtils';

interface ReportsPageProps {
  transactions: Transaction[];
  settings: UserSettings | null;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ transactions, settings }) => {
  const [selectedSection, setSelectedSection] = useState<'overview' | 'subscriptions' | 'installments' | 'budgets'>('overview');
  const [timeHorizon, setTimeHorizon] = useState<3 | 6 | 12>(6);

  // Calculate monthly data for trends
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expense: number; balance: number; date: Date }> = {};

    transactions
      .filter(t => !t.isProjected && !t.isReimbursable) // Exclude reimbursable transactions
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
    return Object.values(data)
      .map(d => ({
        ...d,
        balance: d.income - d.expense
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-timeHorizon);
  }, [transactions, timeHorizon]);

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
        futureInstallments
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions]);

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

      // Count recurring expenses
      transactions
        .filter(t => t.isRecurring && t.type === TransactionType.EXPENSE && !t.isProjected)
        .forEach(t => {
          expenses += t.amount;
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
            <div className="flex items-center justify-between mb-4">
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

          {/* Trend Chart */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Evolução Financeira</h3>
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

          {/* Category Ranking */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Top Categorias de Gastos</h3>
            <div className="space-y-3">
              {categoryRanking.map((cat, idx) => (
                <div key={cat.category} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
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
              ))}
            </div>
          </div>

          {/* Card Comparison */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Comparação de Cartões</h3>
            <div className="space-y-3">
              {cardComparison.map(card => (
                <div key={card.card} className="p-4 bg-zinc-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <CreditCard size={20} className="text-zinc-600" />
                      <p className="font-bold text-zinc-800">{card.card}</p>
                    </div>
                    <p className="font-bold text-lg text-zinc-900">
                      R$ {card.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{card.count} transações</span>
                    <span>Próximas faturas: R$ {card.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Free Balance Projection */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Projeção de Saldo Livre (6 meses)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={freeBalanceProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="freeBalance" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                <div key={sub.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-zinc-800">{sub.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Próxima cobrança: {new Date(sub.nextCharge).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-zinc-900">
                      R$ {sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                    </p>
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
        </div>
      )}

      {/* Installments Section */}
      {selectedSection === 'installments' && (
        <div className="space-y-6">
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
                      <p className="text-xs text-zinc-500 mt-1">
                        {item.issuer && `${item.issuer} • `}
                        {item.paid}/{item.totalInstallments} pagas
                      </p>
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
