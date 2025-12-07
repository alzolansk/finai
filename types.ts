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
  recurringEndDate?: string; // ISO string - Date when recurring transaction was cancelled (projections stop after this date)
  issuer?: string; // Bank/Card issuer (e.g., "Nubank", "Itaú", "C6")
  isAiGenerated?: boolean;
  linkedToInvoice?: boolean; // Indicates if this subscription is linked to a credit card invoice
  creditCardIssuer?: string; // Credit card issuer for linked subscriptions
  createdAt?: number; // Timestamp of when the transaction was created (insertion order)
  movementType?: 'regular' | 'internal_transfer' | 'invoice_payment'; // Type of movement for filtering
  ignoredReason?: string; // Reason why this transaction was ignored (for audit purposes)
  isProjected?: boolean; // Flag to indicate this is a projected recurring transaction (not yet saved to DB)
  isCreditPurchase?: boolean; // Marks that the expense was made on credit and paid on the invoice due date
  tags?: string[]; // Custom tags for advanced filtering (e.g., "viagem", "reembolso")
  isDuplicate?: boolean; // Flag to mark as potential duplicate
  duplicateOf?: string; // Reference to original transaction ID
  isReimbursable?: boolean; // Flag for expenses paid by others (friends using your card)
  reimbursedBy?: string; // Name of person who will reimburse
  debtor?: string; // Name of person who owes money (for INCOME transactions)
  incomeClassification?: IncomeClassification; // For income transactions: fixed vs variable
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
  uiActions?: ChatAction[];
  cta?: ChatCTA;
  ctaStatus?: 'approved' | 'rejected';
}

export interface ChatAction {
  id: string;
  label: string;
  action: 'approve_cta' | 'reject_cta';
}

export interface ChatCTA {
  type: 'wishlist_add';
  name: string;
  rationale?: string;
  suggestedPrice?: number;
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
  isReimbursable?: boolean;
  reimbursedBy?: string;
  debtor?: string;
  tags?: string[];
}

export enum WishlistItemType {
  PURCHASE = 'Compra',
  TRAVEL = 'Viagem',
  EXPERIENCE = 'Experiência',
  INVESTMENT = 'Investimento',
  OTHER = 'Outro'
}

export enum WishlistPriority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta'
}

export interface WishlistItem {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  savedAmount: number;
  type: WishlistItemType;
  priority: WishlistPriority;
  targetDate?: string; // ISO string
  isViable?: boolean; // AI-determined viability
  viabilityDate?: string; // AI-predicted date when it becomes viable
  aiAnalysis?: string; // AI suggestions and insights
  aiRecommendation?: string; // AI recommendation
  paymentOption?: 'cash' | 'installments'; // Payment method
  installmentCount?: number; // Number of installments if applicable
  installmentAmount?: number; // Monthly installment value
  priceResearchConfidence?: 'high' | 'medium' | 'low'; // AI price research confidence
  createdAt: number;
  updatedAt?: number;
  createdViaChat?: boolean; // Flag to indicate item was added by the chat assistant
  isArchived?: boolean; // Lifecycle control: paused/archived
  archivedAt?: number;
}

// Advanced Filter Types
export interface AdvancedFilter {
  id: string;
  name: string;
  dateRange?: { start: string; end: string };
  dateField?: 'payment' | 'purchase';
  categories?: Category[];
  minAmount?: number;
  maxAmount?: number;
  types?: TransactionType[];
  issuers?: string[];
  tags?: string[];
  status?: ('recorrente' | 'parcelado' | 'pago' | 'pendente')[];
  createdAt: number;
}

// Budget/Goal Types
export interface CategoryBudget {
  category: Category;
  limit: number;
  spent: number;
  month: string; // YYYY-MM format
}

// Advanced Budget Management Types
export interface BudgetLimit {
  id: string;
  category?: Category; // Optional - if undefined, it's a global limit
  cardIssuer?: string; // Optional - budget by card
  type: 'category' | 'global' | 'card';
  monthlyLimit: number;
  createdAt: number;
  updatedAt?: number;
  isActive: boolean;
}

export interface BudgetAlert {
  id: string;
  type: 'limit_80' | 'limit_100' | 'unusual_spending' | 'new_subscription' | 'high_invoice' | 'overspend_projection' | 'category_overspend';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  relatedBudgetId?: string;
  relatedCategory?: Category;
  relatedCardIssuer?: string;
  amount?: number;
  threshold?: number;
  createdAt: number;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl?: string;
}

export interface AlertConfiguration {
  id: string;
  alertType: 'limit_80' | 'limit_100' | 'unusual_spending' | 'new_subscription' | 'high_invoice' | 'overspend_projection' | 'category_overspend';
  isEnabled: boolean;
  customThreshold?: number; // For customizable alerts (e.g., trigger at 85% instead of 80%)
  notificationMethod: 'in_app' | 'push' | 'both';
  updatedAt?: number;
}

export interface OverspendProjection {
  willOverspend: boolean;
  projectedOverspendDate?: string; // ISO date when overspend is expected
  projectedOverspendAmount?: number;
  categoryAtRisk?: Category;
  daysUntilOverspend?: number;
  recommendedDailyLimit?: number;
}

export interface SavingsGoal {
  id: string;
  monthlyTarget: number; // Fixed amount
  percentageOfIncome?: number; // Alternative: percentage of income
  currentSaved: number;
  isActive: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface IncomeClassification {
  type: 'fixed' | 'variable';
  description: string;
  expectedAmount?: number; // For fixed income
  frequency?: 'monthly' | 'biweekly' | 'weekly'; // For fixed income
}
