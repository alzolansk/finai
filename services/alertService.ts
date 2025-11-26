import { Transaction, TransactionType, Category, BudgetAlert, AlertConfiguration } from '../types';
import { calculateBudgetStatus } from './budgetService';
import { filterTransactionsByPeriod } from '../utils/dateUtils';
import { getImportedInvoices } from './storageService';

const ALERTS_KEY = 'finai_alerts';
const ALERT_CONFIG_KEY = 'finai_alert_config';

// ===== Alert Storage =====

export const getAlerts = (): BudgetAlert[] => {
  const stored = localStorage.getItem(ALERTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveAlert = (alert: BudgetAlert): BudgetAlert[] => {
  const current = getAlerts();
  const existing = current.find(a => a.id === alert.id);

  let updated;
  if (existing) {
    updated = current.map(a => a.id === alert.id ? alert : a);
  } else {
    updated = [alert, ...current];
  }

  localStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  return updated;
};

export const markAlertAsRead = (id: string): BudgetAlert[] => {
  const current = getAlerts();
  const updated = current.map(a => a.id === id ? { ...a, isRead: true } : a);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  return updated;
};

export const dismissAlert = (id: string): BudgetAlert[] => {
  const current = getAlerts();
  const updated = current.map(a => a.id === id ? { ...a, isDismissed: true } : a);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  return updated;
};

export const clearOldAlerts = (daysOld: number = 30): BudgetAlert[] => {
  const current = getAlerts();
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const updated = current.filter(a => a.createdAt > cutoff);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  return updated;
};

// ===== Alert Configuration =====

const defaultAlertConfigs: AlertConfiguration[] = [
  {
    id: 'limit_80',
    alertType: 'limit_80',
    isEnabled: true,
    customThreshold: 80,
    notificationMethod: 'in_app'
  },
  {
    id: 'limit_100',
    alertType: 'limit_100',
    isEnabled: true,
    customThreshold: 100,
    notificationMethod: 'in_app'
  },
  {
    id: 'unusual_spending',
    alertType: 'unusual_spending',
    isEnabled: true,
    customThreshold: 150, // 150% above average
    notificationMethod: 'in_app'
  },
  {
    id: 'new_subscription',
    alertType: 'new_subscription',
    isEnabled: true,
    notificationMethod: 'in_app'
  },
  {
    id: 'high_invoice',
    alertType: 'high_invoice',
    isEnabled: true,
    customThreshold: 120, // 120% of average
    notificationMethod: 'in_app'
  },
  {
    id: 'overspend_projection',
    alertType: 'overspend_projection',
    isEnabled: true,
    notificationMethod: 'in_app'
  },
  {
    id: 'category_overspend',
    alertType: 'category_overspend',
    isEnabled: true,
    notificationMethod: 'in_app'
  }
];

export const getAlertConfigurations = (): AlertConfiguration[] => {
  const stored = localStorage.getItem(ALERT_CONFIG_KEY);
  if (!stored) {
    localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(defaultAlertConfigs));
    return defaultAlertConfigs;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return defaultAlertConfigs;
  }
};

export const saveAlertConfiguration = (config: AlertConfiguration): AlertConfiguration[] => {
  const current = getAlertConfigurations();
  const updated = current.map(c => c.id === config.id ? { ...config, updatedAt: Date.now() } : c);
  localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(updated));
  return updated;
};

export const toggleAlertType = (alertType: string): AlertConfiguration[] => {
  const current = getAlertConfigurations();
  const updated = current.map(c =>
    c.alertType === alertType ? { ...c, isEnabled: !c.isEnabled, updatedAt: Date.now() } : c
  );
  localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(updated));
  return updated;
};

// ===== Alert Generation =====

export const generateAlerts = (
  transactions: Transaction[],
  monthlyIncome: number,
  currentDate: Date = new Date()
): BudgetAlert[] => {
  const configs = getAlertConfigurations();
  const newAlerts: BudgetAlert[] = [];

  // 1. Budget Limit Alerts (80% and 100%)
  if (configs.find(c => c.alertType === 'limit_80' && c.isEnabled)) {
    const budgetStatuses = calculateBudgetStatus(transactions, currentDate);

    budgetStatuses.forEach(status => {
      const threshold = configs.find(c => c.alertType === 'limit_80')?.customThreshold || 80;

      if (status.percentageUsed >= threshold && status.percentageUsed < 100 && !status.isOverBudget) {
        const alertId = `limit_80_${status.limitId}_${currentDate.toISOString().substring(0, 7)}`;

        newAlerts.push({
          id: alertId,
          type: 'limit_80',
          title: `⚠️ ${status.type === 'category' ? status.category : status.type === 'card' ? status.cardIssuer : 'Orçamento'} em ${Math.round(status.percentageUsed)}%`,
          message: `Você já consumiu ${Math.round(status.percentageUsed)}% do limite. Restam R$ ${status.remaining.toFixed(2)}.`,
          severity: 'warning',
          relatedBudgetId: status.limitId,
          relatedCategory: status.category,
          relatedCardIssuer: status.cardIssuer,
          amount: status.spent,
          threshold: status.limit,
          createdAt: Date.now(),
          isRead: false,
          isDismissed: false
        });
      }
    });
  }

  if (configs.find(c => c.alertType === 'limit_100' && c.isEnabled)) {
    const budgetStatuses = calculateBudgetStatus(transactions, currentDate);

    budgetStatuses.forEach(status => {
      if (status.isOverBudget) {
        const alertId = `limit_100_${status.limitId}_${currentDate.toISOString().substring(0, 7)}`;

        newAlerts.push({
          id: alertId,
          type: 'limit_100',
          title: `🚨 Limite Estourado: ${status.type === 'category' ? status.category : status.type === 'card' ? status.cardIssuer : 'Orçamento'}`,
          message: `Você ultrapassou o limite em R$ ${Math.abs(status.remaining).toFixed(2)} (${Math.round(status.percentageUsed)}%).`,
          severity: 'danger',
          relatedBudgetId: status.limitId,
          relatedCategory: status.category,
          relatedCardIssuer: status.cardIssuer,
          amount: status.spent,
          threshold: status.limit,
          createdAt: Date.now(),
          isRead: false,
          isDismissed: false
        });
      }
    });
  }

  // 2. Unusual Spending Alert
  if (configs.find(c => c.alertType === 'unusual_spending' && c.isEnabled)) {
    const currentMonthExpenses = filterTransactionsByPeriod(transactions, currentDate, 'month')
      .filter(t => t.type === TransactionType.EXPENSE);

    // Calculate category averages from last 3 months
    const categoryAverages: Record<string, number> = {};

    for (let i = 1; i <= 3; i++) {
      const pastDate = new Date(currentDate);
      pastDate.setMonth(pastDate.getMonth() - i);
      const pastExpenses = filterTransactionsByPeriod(transactions, pastDate, 'month')
        .filter(t => t.type === TransactionType.EXPENSE);

      pastExpenses.forEach(t => {
        if (!categoryAverages[t.category]) categoryAverages[t.category] = 0;
        categoryAverages[t.category] += t.amount;
      });
    }

    Object.keys(categoryAverages).forEach(cat => {
      categoryAverages[cat] = categoryAverages[cat] / 3;
    });

    // Check for unusual spending
    const categoryTotals: Record<string, number> = {};
    currentMonthExpenses.forEach(t => {
      if (!categoryTotals[t.category]) categoryTotals[t.category] = 0;
      categoryTotals[t.category] += t.amount;
    });

    const threshold = configs.find(c => c.alertType === 'unusual_spending')?.customThreshold || 150;

    Object.entries(categoryTotals).forEach(([cat, total]) => {
      const avg = categoryAverages[cat] || 0;
      if (avg > 0 && total > avg * (threshold / 100)) {
        const alertId = `unusual_${cat}_${currentDate.toISOString().substring(0, 7)}`;

        newAlerts.push({
          id: alertId,
          type: 'unusual_spending',
          title: `📊 Gasto Incomum: ${cat}`,
          message: `Você gastou R$ ${total.toFixed(2)} em ${cat}, ${Math.round((total / avg - 1) * 100)}% acima da média.`,
          severity: 'warning',
          relatedCategory: cat as Category,
          amount: total,
          threshold: avg,
          createdAt: Date.now(),
          isRead: false,
          isDismissed: false
        });
      }
    });
  }

  // 3. New Subscription Alert
  if (configs.find(c => c.alertType === 'new_subscription' && c.isEnabled)) {
    const last7Days = transactions.filter(t => {
      const tDate = new Date(t.date);
      const diffTime = Math.abs(currentDate.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && t.type === TransactionType.EXPENSE && t.category === Category.SUBSCRIPTIONS;
    });

    const avgSubscription = transactions
      .filter(t => t.category === Category.SUBSCRIPTIONS && t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0) / Math.max(1, transactions.filter(t => t.category === Category.SUBSCRIPTIONS).length);

    last7Days.forEach(sub => {
      if (sub.amount > avgSubscription * 1.2) {
        const alertId = `new_sub_${sub.id}`;

        newAlerts.push({
          id: alertId,
          type: 'new_subscription',
          title: '🔔 Nova Assinatura Detectada',
          message: `${sub.description} (R$ ${sub.amount.toFixed(2)}) está acima da média de assinaturas.`,
          severity: 'info',
          relatedCategory: Category.SUBSCRIPTIONS,
          amount: sub.amount,
          threshold: avgSubscription,
          createdAt: Date.now(),
          isRead: false,
          isDismissed: false
        });
      }
    });
  }

  // 4. High Invoice Alert
  if (configs.find(c => c.alertType === 'high_invoice' && c.isEnabled)) {
    const invoices = getImportedInvoices();
    const last30Days = invoices.filter(inv => {
      const diffTime = Math.abs(currentDate.getTime() - inv.importedAt);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    });

    if (last30Days.length > 0) {
      const avgInvoice = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0) / Math.max(1, invoices.length);
      const threshold = configs.find(c => c.alertType === 'high_invoice')?.customThreshold || 120;

      last30Days.forEach(inv => {
        if (inv.totalAmount > avgInvoice * (threshold / 100)) {
          const alertId = `high_invoice_${inv.id}`;

          newAlerts.push({
            id: alertId,
            type: 'high_invoice',
            title: `💳 Fatura Elevada: ${inv.issuer || 'Cartão'}`,
            message: `Fatura de R$ ${inv.totalAmount.toFixed(2)} está ${Math.round((inv.totalAmount / avgInvoice - 1) * 100)}% acima da média.`,
            severity: 'warning',
            relatedCardIssuer: inv.issuer,
            amount: inv.totalAmount,
            threshold: avgInvoice,
            createdAt: Date.now(),
            isRead: false,
            isDismissed: false
          });
        }
      });
    }
  }

  // 5. Overspend Projection Alert
  if (configs.find(c => c.alertType === 'overspend_projection' && c.isEnabled)) {
    const currentMonthExpenses = filterTransactionsByPeriod(transactions, currentDate, 'month')
      .filter(t => t.type === TransactionType.EXPENSE);

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysPassed = today.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    const totalSpent = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = totalSpent / Math.max(1, daysPassed);
    const projectedTotal = totalSpent + (avgDaily * daysRemaining);

    if (projectedTotal > monthlyIncome && daysRemaining > 0) {
      const remainingBudget = monthlyIncome - totalSpent;
      const daysUntilOverspend = Math.floor(remainingBudget / avgDaily);

      const alertId = `overspend_proj_${currentDate.toISOString().substring(0, 7)}`;

      newAlerts.push({
        id: alertId,
        type: 'overspend_projection',
        title: '⚡ Projeção de Estouro',
        message: `Projeção indica estouro em ${daysUntilOverspend} dias. Limite diário: R$ ${(remainingBudget / daysRemaining).toFixed(2)}.`,
        severity: 'danger',
        amount: projectedTotal,
        threshold: monthlyIncome,
        createdAt: Date.now(),
        isRead: false,
        isDismissed: false
      });
    }
  }

  return newAlerts;
};

// ===== Smart Alert Processing =====

export const processAndSaveAlerts = (
  transactions: Transaction[],
  monthlyIncome: number,
  currentDate: Date = new Date()
): BudgetAlert[] => {
  const existingAlerts = getAlerts();
  const newAlerts = generateAlerts(transactions, monthlyIncome, currentDate);

  // Merge: only add truly new alerts (based on ID)
  const existingIds = new Set(existingAlerts.map(a => a.id));
  const toAdd = newAlerts.filter(a => !existingIds.has(a.id));

  const updated = [...existingAlerts, ...toAdd];
  localStorage.setItem(ALERTS_KEY, JSON.stringify(updated));

  return updated;
};

export const getUnreadAlerts = (): BudgetAlert[] => {
  return getAlerts().filter(a => !a.isRead && !a.isDismissed);
};

export const getActiveAlerts = (): BudgetAlert[] => {
  return getAlerts().filter(a => !a.isDismissed);
};
