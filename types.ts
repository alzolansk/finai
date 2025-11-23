export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum Category {
  FOOD = 'Alimentação',
  TRANSPORT = 'Transporte',
  HOUSING = 'Moradia',
  UTILITIES = 'Contas',
  ENTERTAINMENT = 'Lazer',
  HEALTH = 'Saúde',
  SHOPPING = 'Compras',
  SUBSCRIPTIONS = 'Assinaturas',
  EDUCATION = 'Educação',
  SAVINGS = 'Investimentos',
  SALARY = 'Salário',
  OTHER = 'Outros'
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string - Date of Purchase/Occurrence
  paymentDate?: string; // ISO string - Date of Actual Payment (Cash Flow)
  category: Category;
  type: TransactionType;
  isRecurring?: boolean;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'tip' | 'success';
  savingsPotential?: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  spendingByCategory: { name: string; value: number }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface UserSettings {
  monthlyIncome: number;
  savingsGoal: number; // The target amount to save per month
  onboardingCompleted: boolean;
  fixedExpenses: { description: string; amount: number }[];
}

export type TimePeriod = 'month' | 'year' | 'all';