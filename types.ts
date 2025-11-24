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
  issuer?: string; // Bank/Card issuer (e.g., "Nubank", "Itaú", "C6")
  isAiGenerated?: boolean;
  linkedToInvoice?: boolean; // Indicates if this subscription is linked to a credit card invoice
  creditCardIssuer?: string; // Credit card issuer for linked subscriptions
  createdAt?: number; // Timestamp of when the transaction was created (insertion order)
  movementType?: 'regular' | 'internal_transfer' | 'invoice_payment'; // Type of movement for filtering
  ignoredReason?: string; // Reason why this transaction was ignored (for audit purposes)
  isProjected?: boolean; // Flag to indicate this is a projected recurring transaction (not yet saved to DB)
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'tip' | 'success';
  savingsPotential?: number;
  relatedTransactionId?: string;
  suggestedAmount?: number;
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

export type TipoImportacao = 'extrato_bancario' | 'fatura_cartao' | 'planilha' | 'texto_livre' | 'imagem' | 'pdf' | 'desconhecido';

export interface TransacaoNormalizada {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: Category;
  paymentDate?: string;
  isRecurring?: boolean;
  issuer?: string;
}