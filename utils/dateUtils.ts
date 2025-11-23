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