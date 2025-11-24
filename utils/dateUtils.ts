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
    const tDate = new Date(effectiveDateStr);
    
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
    const originalDate = new Date(recurring.date);
    const originalPaymentDate = recurring.paymentDate ? new Date(recurring.paymentDate) : null;

    // Only project if the target month is after or equal to the original month
    if (
      targetYear > originalDate.getFullYear() ||
      (targetYear === originalDate.getFullYear() && targetMonth >= originalDate.getMonth())
    ) {
      // Calculate the new dates for the target month
      const dayOfMonth = originalDate.getDate();
      const projectedDate = new Date(targetYear, targetMonth, dayOfMonth);

      // Handle edge case where day doesn't exist in target month (e.g., Feb 31 -> Feb 28)
      if (projectedDate.getMonth() !== targetMonth) {
        projectedDate.setDate(0); // Set to last day of previous month
      }

      let projectedPaymentDate: string | undefined;
      if (originalPaymentDate) {
        const paymentDayOfMonth = originalPaymentDate.getDate();
        const newPaymentDate = new Date(targetYear, targetMonth, paymentDayOfMonth);

        if (newPaymentDate.getMonth() !== targetMonth) {
          newPaymentDate.setDate(0);
        }

        projectedPaymentDate = newPaymentDate.toISOString().split('T')[0];
      }

      // Check if this projection already exists as a real transaction in the target month
      const alreadyExists = transactions.some(t => {
        const tDate = new Date(t.paymentDate || t.date);
        return (
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
          date: projectedDate.toISOString().split('T')[0],
          paymentDate: projectedPaymentDate,
          isProjected: true, // Flag to indicate this is a projected transaction
        } as Transaction & { isProjected?: boolean });
      }
    }
  });

  return projected;
};