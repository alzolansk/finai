import { Transaction, TransactionType, Category, BudgetLimit, OverspendProjection, SavingsGoal } from '../types';
import { filterTransactionsByPeriod } from '../utils/dateUtils';

const BUDGET_LIMITS_KEY = 'finai_budget_limits';
const SAVINGS_GOALS_KEY = 'finai_savings_goals';

// ===== Budget Limits Management =====

export const getBudgetLimits = (): BudgetLimit[] => {
  const stored = localStorage.getItem(BUDGET_LIMITS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveBudgetLimit = (limit: BudgetLimit): BudgetLimit[] => {
  const current = getBudgetLimits();
  const index = current.findIndex(l => l.id === limit.id);

  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...limit, updatedAt: Date.now() };
  } else {
    updated = [limit, ...current];
  }

  localStorage.setItem(BUDGET_LIMITS_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteBudgetLimit = (id: string): BudgetLimit[] => {
  const current = getBudgetLimits();
  const updated = current.filter(l => l.id !== id);
  localStorage.setItem(BUDGET_LIMITS_KEY, JSON.stringify(updated));
  return updated;
};

export const toggleBudgetLimit = (id: string): BudgetLimit[] => {
  const current = getBudgetLimits();
  const index = current.findIndex(l => l.id === id);

  if (index >= 0) {
    const updated = [...current];
    updated[index] = { ...updated[index], isActive: !updated[index].isActive, updatedAt: Date.now() };
    localStorage.setItem(BUDGET_LIMITS_KEY, JSON.stringify(updated));
    return updated;
  }

  return current;
};

// ===== Budget Analysis =====

export interface BudgetStatus {
  limitId: string;
  type: 'category' | 'global' | 'card';
  category?: Category;
  cardIssuer?: string;
  limit: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isOverBudget: boolean;
  projectedSpend: number;
  projectedPercentage: number;
  willExceed: boolean;
}

export const calculateBudgetStatus = (
  transactions: Transaction[],
  currentDate: Date = new Date()
): BudgetStatus[] => {
  const limits = getBudgetLimits().filter(l => l.isActive);
  const currentMonthTransactions = filterTransactionsByPeriod(transactions, currentDate, 'month');
  const expenses = currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE);

  const statuses: BudgetStatus[] = [];

  // Calculate days for projection
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const daysRemaining = daysInMonth - daysPassed;

  limits.forEach(limit => {
    let spent = 0;

    if (limit.type === 'global') {
      spent = expenses.reduce((sum, t) => sum + t.amount, 0);
    } else if (limit.type === 'category' && limit.category) {
      spent = expenses
        .filter(t => t.category === limit.category)
        .reduce((sum, t) => sum + t.amount, 0);
    } else if (limit.type === 'card' && limit.cardIssuer) {
      spent = expenses
        .filter(t =>
          t.issuer?.toLowerCase().includes(limit.cardIssuer!.toLowerCase()) ||
          t.creditCardIssuer?.toLowerCase().includes(limit.cardIssuer!.toLowerCase())
        )
        .reduce((sum, t) => sum + t.amount, 0);
    }

    const remaining = limit.monthlyLimit - spent;
    const percentageUsed = (spent / limit.monthlyLimit) * 100;

    // Project spending
    const avgDaily = spent / Math.max(1, daysPassed);
    const projectedSpend = spent + (avgDaily * daysRemaining);
    const projectedPercentage = (projectedSpend / limit.monthlyLimit) * 100;

    statuses.push({
      limitId: limit.id,
      type: limit.type,
      category: limit.category,
      cardIssuer: limit.cardIssuer,
      limit: limit.monthlyLimit,
      spent,
      remaining,
      percentageUsed,
      isOverBudget: spent > limit.monthlyLimit,
      projectedSpend,
      projectedPercentage,
      willExceed: projectedSpend > limit.monthlyLimit
    });
  });

  return statuses;
};

// ===== Overspend Projection =====

export const calculateOverspendProjection = (
  transactions: Transaction[],
  monthlyIncome: number,
  currentDate: Date = new Date()
): OverspendProjection => {
  const currentMonthTransactions = filterTransactionsByPeriod(transactions, currentDate, 'month');
  const expenses = currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const daysRemaining = daysInMonth - daysPassed;

  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
  const avgDaily = totalSpent / Math.max(1, daysPassed);
  const projectedTotal = totalSpent + (avgDaily * daysRemaining);

  if (projectedTotal <= monthlyIncome) {
    return { willOverspend: false };
  }

  // Calculate when overspend will occur
  const remainingBudget = monthlyIncome - totalSpent;
  const daysUntilOverspend = Math.floor(remainingBudget / avgDaily);

  const overspendDate = new Date(today);
  overspendDate.setDate(overspendDate.getDate() + daysUntilOverspend);

  // Find category at risk (highest projected overspend)
  const categorySpending: Record<string, { spent: number; projected: number }> = {};

  expenses.forEach(t => {
    if (!categorySpending[t.category]) {
      categorySpending[t.category] = { spent: 0, projected: 0 };
    }
    categorySpending[t.category].spent += t.amount;
  });

  Object.keys(categorySpending).forEach(cat => {
    const spent = categorySpending[cat].spent;
    const dailyAvg = spent / Math.max(1, daysPassed);
    categorySpending[cat].projected = spent + (dailyAvg * daysRemaining);
  });

  const categoryAtRisk = Object.entries(categorySpending)
    .sort((a, b) => b[1].projected - a[1].projected)[0]?.[0] as Category | undefined;

  const recommendedDailyLimit = (monthlyIncome - totalSpent) / Math.max(1, daysRemaining);

  return {
    willOverspend: true,
    projectedOverspendDate: overspendDate.toISOString(),
    projectedOverspendAmount: projectedTotal - monthlyIncome,
    categoryAtRisk,
    daysUntilOverspend,
    recommendedDailyLimit
  };
};

// ===== Savings Goals =====

export const getSavingsGoals = (): SavingsGoal[] => {
  const stored = localStorage.getItem(SAVINGS_GOALS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveSavingsGoal = (goal: SavingsGoal): SavingsGoal[] => {
  const current = getSavingsGoals();
  const index = current.findIndex(g => g.id === goal.id);

  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...goal, updatedAt: Date.now() };
  } else {
    updated = [goal, ...current];
  }

  localStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteSavingsGoal = (id: string): SavingsGoal[] => {
  const current = getSavingsGoals();
  const updated = current.filter(g => g.id !== id);
  localStorage.setItem(SAVINGS_GOALS_KEY, JSON.stringify(updated));
  return updated;
};

export const checkSavingsGoalFeasibility = (
  transactions: Transaction[],
  goal: SavingsGoal,
  monthlyIncome: number,
  currentDate: Date = new Date()
): { isFeasible: boolean; shortfall?: number; message: string } => {
  const budgetStatuses = calculateBudgetStatus(transactions, currentDate);
  const totalBudgeted = budgetStatuses
    .filter(s => s.type === 'global')
    .reduce((sum, s) => sum + s.limit, 0);

  const availableForSavings = monthlyIncome - totalBudgeted;
  const targetAmount = goal.percentageOfIncome
    ? (monthlyIncome * goal.percentageOfIncome / 100)
    : goal.monthlyTarget;

  if (availableForSavings >= targetAmount) {
    return {
      isFeasible: true,
      message: `Você pode economizar R$ ${targetAmount.toFixed(2)} por mês com seu orçamento atual.`
    };
  }

  const shortfall = targetAmount - availableForSavings;
  return {
    isFeasible: false,
    shortfall,
    message: `Seu orçamento atual inviabiliza a meta. Ajuste os gastos em R$ ${shortfall.toFixed(2)}.`
  };
};

// ===== Dynamic Adjustment Suggestions =====

export interface BudgetAdjustmentSuggestion {
  category: Category;
  currentLimit: number;
  suggestedLimit: number;
  reduction: number;
  rationale: string;
}

export const generateBudgetAdjustments = (
  transactions: Transaction[],
  monthlyIncome: number,
  savingsTarget?: number
): BudgetAdjustmentSuggestion[] => {
  const last3MonthsExpenses: Record<string, number[]> = {};

  // Analyze last 3 months
  for (let i = 0; i < 3; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthTransactions = filterTransactionsByPeriod(transactions, date, 'month');

    monthTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        if (!last3MonthsExpenses[t.category]) {
          last3MonthsExpenses[t.category] = [];
        }
        last3MonthsExpenses[t.category].push(t.amount);
      });
  }

  const suggestions: BudgetAdjustmentSuggestion[] = [];
  const discretionaryCategories = [Category.ENTERTAINMENT, Category.SHOPPING, Category.FOOD, Category.SUBSCRIPTIONS];

  discretionaryCategories.forEach(category => {
    const expenses = last3MonthsExpenses[category] || [];
    if (expenses.length === 0) return;

    const avgMonthly = expenses.reduce((sum, amt) => sum + amt, 0) / 3;
    const suggestedLimit = avgMonthly * 0.8; // Reduce by 20%
    const reduction = avgMonthly - suggestedLimit;

    if (reduction > 50) { // Only suggest if meaningful reduction
      suggestions.push({
        category,
        currentLimit: avgMonthly,
        suggestedLimit,
        reduction,
        rationale: `Baseado nos últimos 3 meses, você pode reduzir ${category} para economizar mais.`
      });
    }
  });

  return suggestions.sort((a, b) => b.reduction - a.reduction);
};
