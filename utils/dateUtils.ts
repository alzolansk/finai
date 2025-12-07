import { Transaction, TimePeriod } from '../types';

export const getMonthName = (date: Date): string => {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export const filterTransactionsByPeriod = (
  transactions: Transaction[],
  currentDate: Date,
  period: TimePeriod
): Transaction[] => {
  return transactions.filter(t => {
    // CRITICAL: Use paymentDate if available for Cash Flow view. 
    // If not, fall back to date.
    const effectiveDateStr = t.paymentDate || t.date;
    const tDate = normalizeToLocalDate(effectiveDateStr) || new Date(effectiveDateStr);
    
    if (period === 'month') {
      return (
        tDate.getMonth() === currentDate.getMonth() &&
        tDate.getFullYear() === currentDate.getFullYear()
      );
    }
    
    if (period === 'year') {
      return tDate.getFullYear() === currentDate.getFullYear();
    }
    
    return true; // 'all'
  });
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
};

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const addMonths = (date: Date, months: number): Date => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

export const parseLocalDate = (dateString: string): Date => {
  // Handles YYYY-MM-DD string and returns a Date object set to 00:00:00 Local Time
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Normalize any ISO/string date into a local Date at midnight to avoid timezone shifts
const normalizeToLocalDate = (dateString?: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

/**
 * Projects recurring transactions into future months
 * @param transactions - All transactions
 * @param targetDate - The date (month/year) to project transactions for
 * @returns Array of projected recurring transactions for the target month
 */
export const projectRecurringTransactions = (
  transactions: Transaction[],
  targetDate: Date
): Transaction[] => {
  const recurringTransactions = transactions.filter(t => t.isRecurring);
  const projected: Transaction[] = [];

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();

  recurringTransactions.forEach(recurring => {
    // Anchor recurrence on the cash-flow date (paymentDate if available)
    const anchorDate = normalizeToLocalDate(recurring.paymentDate || recurring.date);
    const paymentAnchorDate = normalizeToLocalDate(recurring.paymentDate || recurring.date);

    if (!anchorDate) {
      return;
    }

    // Check if this recurring transaction has been cancelled
    // If recurringEndDate is set, don't project for months after that date
    if (recurring.recurringEndDate) {
      const endDate = normalizeToLocalDate(recurring.recurringEndDate);
      if (endDate) {
        // Don't project if target month is on or after the end date month
        if (
          targetYear > endDate.getFullYear() ||
          (targetYear === endDate.getFullYear() && targetMonth >= endDate.getMonth())
        ) {
          return; // Skip this recurring transaction for this target month
        }
      }
    }

    // Only project if the target month is AFTER the original month (not the same month)
    if (
      targetYear > anchorDate.getFullYear() ||
      (targetYear === anchorDate.getFullYear() && targetMonth > anchorDate.getMonth())
    ) {
      // Calculate the new dates for the target month
      const dayOfMonth = anchorDate.getDate();
      const projectedDate = new Date(targetYear, targetMonth, dayOfMonth);

      // Handle edge case where day doesn't exist in target month (e.g., Feb 31 -> Feb 28)
      if (projectedDate.getMonth() !== targetMonth) {
        projectedDate.setDate(0); // Set to last day of previous month
      }

      let projectedPaymentDate: string | undefined;
      const paymentDayOfMonth = (paymentAnchorDate || anchorDate).getDate();
      const newPaymentDate = new Date(targetYear, targetMonth, paymentDayOfMonth);

      if (newPaymentDate.getMonth() !== targetMonth) {
        newPaymentDate.setDate(0);
      }

      // Store as full ISO to keep consistency with saved transactions
      projectedPaymentDate = newPaymentDate.toISOString();

      // Check if this projection already exists as a real transaction in the target month
      const alreadyExists = transactions.some(t => {
        const tDate = normalizeToLocalDate(t.paymentDate || t.date);
        return (
          tDate &&
          t.description === recurring.description &&
          tDate.getFullYear() === targetYear &&
          tDate.getMonth() === targetMonth &&
          t.id !== recurring.id
        );
      });

      // Only add projected transaction if it doesn't already exist
      if (!alreadyExists) {
        projected.push({
          ...recurring,
          id: `projected-${recurring.id}-${targetYear}-${targetMonth}`,
          date: projectedDate.toISOString(),
          paymentDate: projectedPaymentDate,
          isProjected: true, // Flag to indicate this is a projected transaction
        } as Transaction & { isProjected?: boolean });
      }
    }
  });

  return projected;
};
