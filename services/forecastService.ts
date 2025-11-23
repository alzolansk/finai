import { Transaction, TransactionType, UserSettings, Category } from '../types';
import { filterTransactionsByPeriod } from '../utils/dateUtils';

export interface ForecastResult {
  predictedBalance: number;
  predictedIncome: number;
  predictedExpense: number;
  riskCategories: { category: string; current: number; projected: number; limit: number }[];
}

export interface SmartAlert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
}

export const calculateMonthlyForecast = (
  transactions: Transaction[],
  currentDate: Date,
  settings: UserSettings | null,
  isTurboMode: boolean = false
): ForecastResult => {
  const currentMonthTransactions = filterTransactionsByPeriod(transactions, currentDate, 'month');
  
  // 1. Calculate Current Totals
  const currentIncome = currentMonthTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const currentExpense = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Project Expenses
  // Strategy: Fixed Expenses (not yet paid) + Variable Expenses (projected by daily avg)
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const today = new Date().getDate();
  // If looking at past/future months, handle differently. Assuming current month for now.
  // If currentDate is not current real month, we just show actuals or full projection? 
  // Let's assume we are forecasting for the *active* view month.
  
  const isCurrentRealMonth = 
    currentDate.getMonth() === new Date().getMonth() && 
    currentDate.getFullYear() === new Date().getFullYear();

  let projectedExpense = currentExpense;
  let projectedIncome = currentIncome;

  if (isCurrentRealMonth) {
    // A. Fixed Expenses Check
    // We need to see which fixed expenses from settings haven't been paid yet.
    // Heuristic: Match description fuzzy or exact? 
    // Simple: Check if a transaction with similar amount (+- 10%) and description exists.
    
    let pendingFixedExpenses = 0;
    if (settings?.fixedExpenses) {
      settings.fixedExpenses.forEach(fixed => {
        const found = currentMonthTransactions.find(t => 
          t.type === TransactionType.EXPENSE &&
          t.amount >= fixed.amount * 0.9 && 
          t.amount <= fixed.amount * 1.1 &&
          (t.description.toLowerCase().includes(fixed.description.toLowerCase()) || fixed.description.toLowerCase().includes(t.description.toLowerCase()))
        );
        
        if (!found) {
          pendingFixedExpenses += fixed.amount;
        }
      });
    }

    // B. Variable Expense Projection
    // Calculate variable expenses so far (Total - Fixed Found)
    // This is hard to separate perfectly without tagging. 
    // Simplified: Calculate average daily burn rate of *all* expenses and project, 
    // BUT that double counts fixed expenses if we just multiply.
    
    // Better approach for MVP:
    // Projected = Current + (Average Daily of *Variable* * Days Remaining) + Pending Fixed
    // Let's just use a simple linear projection for now, but damped.
    
    const daysPassed = Math.max(1, today);
    const daysRemaining = daysInMonth - daysPassed;
    
    // Average daily spend so far
    const avgDaily = currentExpense / daysPassed;
    
    // We project the remaining days. 
    // To avoid over-projecting one-off big purchases, we might want to use median or exclude outliers, 
    // but mean is standard for MVP.
    const projectedVariable = avgDaily * daysRemaining;
    
    // We use a weighted approach: 50% linear projection, 50% just fixed additions.
    // Actually, let's be conservative: Current + Pending Fixed + (Daily Avg * Remaining * 0.8)
    // The 0.8 factor assumes spending slows down or some days are zero.
    
    projectedExpense = currentExpense + pendingFixedExpenses + (avgDaily * daysRemaining * 0.8);
    
    // Cap projection? No.
  }

  // 3. Risk Categories
  // Identify categories that are trending high compared to historical average (if we had it)
  // For now, let's define arbitrary "soft limits" based on income percentage if available.
  // e.g. Food shouldn't be > 30% of income.
  
  const riskCategories: { category: string; current: number; projected: number; limit: number }[] = [];
  
  if (settings?.monthlyIncome) {
    const categories = Object.values(Category);
    const spendByCategory: Record<string, number> = {};
    
    currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      spendByCategory[t.category] = (spendByCategory[t.category] || 0) + t.amount;
    });

    // Simple rules
    const limits: Partial<Record<Category, number>> = {
      [Category.FOOD]: 0.25, // 25% of income
      [Category.HOUSING]: 0.35,
      [Category.TRANSPORT]: 0.15,
      [Category.ENTERTAINMENT]: 0.10
    };

    // Apply Turbo Mode: Reduce limits by 20%
    if (isTurboMode) {
        Object.keys(limits).forEach(key => {
            const k = key as Category;
            if (limits[k]) {
                limits[k] = limits[k]! * 0.8;
            }
        });
    }

    Object.entries(spendByCategory).forEach(([cat, amount]) => {
      const limitPct = limits[cat as Category];
      if (limitPct) {
        const limitAmount = settings.monthlyIncome * limitPct;
        // Simple projection for category
        const projectedCat = isCurrentRealMonth 
          ? amount + ((amount / Math.max(1, today)) * (daysInMonth - today))
          : amount;

        if (projectedCat > limitAmount) {
          riskCategories.push({
            category: cat,
            current: amount,
            projected: projectedCat,
            limit: limitAmount
          });
        }
      }
    });

    // Logic: Housing is a fundamental need. Only alert if there are NO other unnecessary expenses risking the budget.
    // If we have risks in Entertainment, Shopping, or Subscriptions, we prioritize those alerts and ignore Housing "overspending".
    const nonEssentialCategories = [Category.ENTERTAINMENT, Category.SHOPPING, Category.SUBSCRIPTIONS];
    const hasNonEssentialRisk = riskCategories.some(r => nonEssentialCategories.includes(r.category as Category));

    if (hasNonEssentialRisk) {
        const housingIndex = riskCategories.findIndex(r => r.category === Category.HOUSING);
        if (housingIndex !== -1) {
            riskCategories.splice(housingIndex, 1);
        }
    }
  }

  return {
    predictedBalance: projectedIncome - projectedExpense,
    predictedIncome: projectedIncome,
    predictedExpense: projectedExpense,
    riskCategories
  };
};

export const generateSmartAlerts = (
  transactions: Transaction[],
  settings: UserSettings | null,
  isTurboMode: boolean = false
): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  const today = new Date();
  const currentMonthTransactions = filterTransactionsByPeriod(transactions, today, 'month');

  // Turbo Mode Alert
  if (isTurboMode) {
      alerts.push({
          id: 'turbo-active',
          type: 'info',
          title: 'Modo Turbo Ativo 🚀',
          message: 'Seus limites de categoria foram reduzidos em 20% para maximizar a economia.',
      });
  }

  // 1. Check for "Estouro" (Overspending)
  if (settings?.monthlyIncome) {
    const totalExpense = currentMonthTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);
      
    if (totalExpense > settings.monthlyIncome) {
      alerts.push({
        id: 'overspend-1',
        type: 'danger',
        title: 'Orçamento Estourado',
        message: `Você já gastou R$ ${(totalExpense - settings.monthlyIncome).toFixed(0)} a mais que sua renda mensal.`,
        action: 'Revisar gastos'
      });
    } else if (totalExpense > settings.monthlyIncome * 0.9) {
      alerts.push({
        id: 'overspend-warning',
        type: 'warning',
        title: 'Atenção ao Limite',
        message: 'Você já consumiu 90% da sua renda mensal.',
        action: 'Ver detalhes'
      });
    }
  }

  // 2. Check for High Frequency Categories (e.g. Uber/iFood spam)
  // Count transactions by category in last 7 days
  const last7Days = transactions.filter(t => {
    const tDate = new Date(t.date);
    const diffTime = Math.abs(today.getTime() - tDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && t.type === TransactionType.EXPENSE;
  });

  const countByCategory: Record<string, number> = {};
  last7Days.forEach(t => {
    countByCategory[t.category] = (countByCategory[t.category] || 0) + 1;
  });

  Object.entries(countByCategory).forEach(([cat, count]) => {
    // Housing is usually paid once or twice, but shouldn't be flagged as "habit" even if split
    if (cat === Category.HOUSING) return;

    if (count >= 5) { // 5 times in a week
       alerts.push({
        id: `freq-${cat}`,
        type: 'info',
        title: `Hábito Frequente: ${cat}`,
        message: `Você fez ${count} transações de ${cat} nos últimos 7 dias.`,
        action: 'Ver histórico'
      });
    }
  });

  // 3. Large Single Expense
  // Exclude Housing (Rent/Mortgage is expected to be large)
  const largeExpense = currentMonthTransactions.find(t => 
    t.type === TransactionType.EXPENSE && 
    t.amount > 1000 && 
    t.category !== Category.HOUSING
  ); 
  if (largeExpense) {
     // Only show if recent (last 3 days)
     const tDate = new Date(largeExpense.date);
     const diffDays = (today.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
     if (diffDays <= 3) {
        alerts.push({
            id: `large-${largeExpense.id}`,
            type: 'info',
            title: 'Gasto Elevado Detectado',
            message: `Uma compra de R$ ${largeExpense.amount.toLocaleString('pt-BR')} em ${largeExpense.category} impactou seu saldo.`,
        });
     }
  }

  // 4. Emotional/Impulse Detection (Late Night Spending)
  const lateNightTx = currentMonthTransactions.filter(t => {
    const date = new Date(t.date);
    const hour = date.getHours();
    return (hour >= 23 || hour <= 4) && t.type === TransactionType.EXPENSE;
  });

  if (lateNightTx.length > 0) {
    const recentLateNight = lateNightTx.find(t => {
        const tDate = new Date(t.date);
        const diffDays = (today.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 2;
    });

    if (recentLateNight) {
        alerts.push({
            id: 'emotional-night',
            type: 'warning',
            title: 'Compras Noturnas',
            message: 'Detectamos gastos de madrugada. Compras nesse horário tendem a ser impulsivas.',
            action: 'Ver dicas'
        });
    }
  }

  return alerts;
};
