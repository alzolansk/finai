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
  isCreditPurchase?: boolean; // Marks that the expense was made on credit and paid on the invoice due date
  tags?: string[]; // Custom tags for advanced filtering (e.g., "viagem", "reembolso")
  isDuplicate?: boolean; // Flag to mark as potential duplicate
  duplicateOf?: string; // Reference to original transaction ID
  isReimbursable?: boolean; // Flag for expenses paid by others (friends using your card)
  reimbursedBy?: string; // Name of person who will reimburse
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
}

// Advanced Filter Types
export interface AdvancedFilter {
  id: string;
  name: string;
  dateRange?: { start: string; end: string };
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
