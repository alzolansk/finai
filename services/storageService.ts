import { Transaction, TransactionType, UserSettings, WishlistItem } from '../types';

const TRANSACTIONS_KEY = 'finai_transactions';
const SETTINGS_KEY = 'finai_settings';
const SAVINGS_REVIEWS_KEY = 'finai_savings_reviews';
const WISHLIST_KEY = 'finai_wishlist';

// --- Transactions ---

export const getTransactions = (): Transaction[] => {
  const stored = localStorage.getItem(TRANSACTIONS_KEY);
  if (!stored) return [];
  try {
    const transactions = JSON.parse(stored);
    // Migrate old transactions without createdAt
    let needsMigration = false;
    const migrated = transactions.map((t: Transaction, index: number) => {
      if (!t.createdAt) {
        needsMigration = true;
        // Assign timestamps in reverse order (oldest first) to preserve insertion order
        // Use the payment date as a base timestamp
        const baseTimestamp = new Date(t.paymentDate || t.date).getTime();
        return { ...t, createdAt: baseTimestamp - (transactions.length - index) };
      }
      return t;
    });
    
    if (needsMigration) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(migrated));
      return migrated;
    }
    
    return transactions;
  } catch (e) {
    console.error("Failed to parse transactions", e);
    return [];
  }
};

export const saveTransaction = (transaction: Transaction): Transaction[] => {
  const current = getTransactions();
  const updated = [transaction, ...current];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteTransaction = (id: string): Transaction[] => {
  const current = getTransactions();
  const updated = current.filter(t => t.id !== id);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
  return updated;
};

export const updateTransaction = (transaction: Transaction): Transaction[] => {
  const current = getTransactions();
  const index = current.findIndex(t => t.id === transaction.id);
  if (index >= 0) {
    const updated = [...current];
    updated[index] = transaction;
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    return updated;
  }
  return current;
};

// --- Settings & Onboarding ---

export const getUserSettings = (): UserSettings | null => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
};

export const saveUserSettings = (settings: UserSettings): UserSettings => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
};

export const seedInitialData = (): Transaction[] => {
  const current = getTransactions();
  if (current.length > 0) return current;
  // No auto-seeding transactions to force onboarding experience,
  // or seed minimal if needed. Returning empty to let user start fresh usually better for "personal" feel.
  return [];
};

// --- Imported Invoices Tracking ---

const IMPORTED_INVOICES_KEY = 'finai_imported_invoices';

export interface ImportedInvoice {
  id: string;
  dueDate: string;
  totalAmount: number;
  transactionCount: number;
  importedAt: number;
  fingerprint: string; // Hash of key transaction details
  transactionIds?: string[]; // IDs of transactions created from this invoice
  issuer?: string; // Bank/Card issuer name
}

export const getImportedInvoices = (): ImportedInvoice[] => {
  const stored = localStorage.getItem(IMPORTED_INVOICES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse imported invoices", e);
    return [];
  }
};

export const saveImportedInvoice = (invoice: ImportedInvoice): void => {
  const current = getImportedInvoices();
  const updated = [invoice, ...current];
  localStorage.setItem(IMPORTED_INVOICES_KEY, JSON.stringify(updated));
};

// Check if transactions from an invoice still exist in the system
export const doInvoiceTransactionsExist = (invoice: ImportedInvoice): boolean => {
  // If no transaction IDs were stored (old invoices), we can't verify
  if (!invoice.transactionIds || invoice.transactionIds.length === 0) {
    return true; // Assume they exist to maintain backward compatibility
  }

  const currentTransactions = getTransactions();
  const currentIds = new Set(currentTransactions.map(t => t.id));

  // Count how many of the original transactions still exist
  const existingCount = invoice.transactionIds.filter(id => currentIds.has(id)).length;

  // If less than 50% of transactions exist, consider them deleted
  // This allows for some flexibility if user deleted a few items but not all
  return existingCount >= (invoice.transactionIds.length * 0.5);
};

export const isInvoiceAlreadyImported = (fingerprint: string): ImportedInvoice | null => {
  const invoices = getImportedInvoices();
  const matchingInvoice = invoices.find(inv => inv.fingerprint === fingerprint);

  if (!matchingInvoice) {
    return null; // Not imported before
  }

  // Check if the transactions still exist
  if (!doInvoiceTransactionsExist(matchingInvoice)) {
    return null; // Transactions were deleted, allow re-import
  }

  return matchingInvoice; // Transactions still exist, block duplicate
};

// Generate a unique fingerprint for an invoice
export const generateInvoiceFingerprint = (dueDate: string | null, transactions: any[]): string => {
  // Create a fingerprint based on:
  // - Due date (if available)
  // - Total amount
  // - First 3 transaction descriptions and amounts
  const dueDatePart = dueDate || 'no-date';
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const firstThree = transactions.slice(0, 3).map(t => `${t.description}:${t.amount}`).join('|');

  const combined = `${dueDatePart}-${totalAmount.toFixed(2)}-${firstThree}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `invoice-${Math.abs(hash)}`;
};

// --- Savings Reviews ---

export type RecommendationStatus = 'pending' | 'kept' | 'dismissed' | 'adjusted';

export interface SavingsReview {
  id: string; // Matches the SavingsItem id
  status: RecommendationStatus;
  justification?: string;
  adjustedAmount?: number;
  reviewedAt: number;
}

export const getSavingsReviews = (): SavingsReview[] => {
  const stored = localStorage.getItem(SAVINGS_REVIEWS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveSavingsReview = (review: SavingsReview): SavingsReview[] => {
  const current = getSavingsReviews();
  const index = current.findIndex(r => r.id === review.id);
  
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = review;
  } else {
    updated = [...current, review];
  }
  
  localStorage.setItem(SAVINGS_REVIEWS_KEY, JSON.stringify(updated));
  return updated;
};

export const clearAllData = (): void => {
  localStorage.removeItem(TRANSACTIONS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SAVINGS_REVIEWS_KEY);
  localStorage.removeItem(IMPORTED_INVOICES_KEY);
  localStorage.removeItem(API_LOGS_KEY);
  localStorage.removeItem(WISHLIST_KEY);
  localStorage.removeItem(AGENDA_CHECKLIST_KEY);
};

// --- API Monitoring ---

const API_LOGS_KEY = 'finai_api_logs';

export interface ApiLog {
  id: string;
  timestamp: number;
  endpoint: string;
  status: 'success' | 'error';
  duration: number;
  error?: string;
}

export const getApiLogs = (): ApiLog[] => {
  const stored = localStorage.getItem(API_LOGS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const logApiCall = (log: Omit<ApiLog, 'id' | 'timestamp'>) => {
  const logs = getApiLogs();
  const newLog: ApiLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  // Keep last 50 logs
  const updated = [newLog, ...logs].slice(0, 50);
  localStorage.setItem(API_LOGS_KEY, JSON.stringify(updated));
};

export const clearApiLogs = () => {
  localStorage.removeItem(API_LOGS_KEY);
};

// --- Agenda Checklist ---

const AGENDA_CHECKLIST_KEY = 'finai_agenda_checklist';

export interface AgendaChecklistEntry {
  targetId: string; // ID of the invoice or recurring transaction definition
  monthKey: string; // YYYY-MM
  paidAt: string; // ISO Date
}

export const getAgendaChecklist = (): AgendaChecklistEntry[] => {
  const stored = localStorage.getItem(AGENDA_CHECKLIST_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const toggleAgendaChecklist = (entry: AgendaChecklistEntry): AgendaChecklistEntry[] => {
  const current = getAgendaChecklist();
  const index = current.findIndex(e => e.targetId === entry.targetId && e.monthKey === entry.monthKey);

  let updated;
  if (index >= 0) {
    // Remove if exists (toggle off)
    updated = current.filter((_, i) => i !== index);
  } else {
    // Add if not exists (toggle on)
    updated = [...current, entry];
  }

  localStorage.setItem(AGENDA_CHECKLIST_KEY, JSON.stringify(updated));
  return updated;
};

// --- Wishlist Items ---

export const getWishlistItems = (): WishlistItem[] => {
  const stored = localStorage.getItem(WISHLIST_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveWishlistItem = (item: WishlistItem): WishlistItem[] => {
  const current = getWishlistItems();
  const index = current.findIndex(w => w.id === item.id);

  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...item, updatedAt: Date.now() };
  } else {
    updated = [item, ...current];
  }

  localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteWishlistItem = (id: string): WishlistItem[] => {
  const current = getWishlistItems();
  const updated = current.filter(w => w.id !== id);
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
  return updated;
};

export const updateWishlistItemAmount = (id: string, savedAmount: number): WishlistItem[] => {
  const current = getWishlistItems();
  const index = current.findIndex(w => w.id === id);

  if (index >= 0) {
    const updated = [...current];
    updated[index] = { ...updated[index], savedAmount, updatedAt: Date.now() };
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
    return updated;
  }

  return current;
};

// --- Credit Card Intelligence ---

export interface CreditCardInfo {
  issuer: string;
  mostCommonDueDay: number; // Day of month (1-31)
  lastInvoiceDate?: string;
  transactionCount: number;
}

/**
 * Analyzes transaction history to extract credit card patterns
 * Returns list of credit cards with their most common due dates
 */
export const getCreditCardHistory = (): CreditCardInfo[] => {
  const transactions = getTransactions();
  const invoices = getImportedInvoices();

  // Map to store issuer -> due days frequency
  const issuerData = new Map<string, { dueDays: number[], lastDate: string, count: number }>();

  // 1. Analyze imported invoices (more reliable for due dates)
  invoices.forEach(invoice => {
    if (invoice.issuer && invoice.dueDate && invoice.dueDate !== 'no-date') {
      const dueDay = new Date(invoice.dueDate).getDate();
      const existing = issuerData.get(invoice.issuer);

      if (existing) {
        existing.dueDays.push(dueDay);
        existing.count += invoice.transactionCount;
        // Keep most recent date
        if (new Date(invoice.dueDate) > new Date(existing.lastDate)) {
          existing.lastDate = invoice.dueDate;
        }
      } else {
        issuerData.set(invoice.issuer, {
          dueDays: [dueDay],
          lastDate: invoice.dueDate,
          count: invoice.transactionCount
        });
      }
    }
  });

  // 2. Also check transactions with creditCardIssuer (for recurring subscriptions)
  transactions.forEach(t => {
    if (t.creditCardIssuer && t.isCreditPurchase && t.paymentDate) {
      const dueDay = new Date(t.paymentDate).getDate();
      const existing = issuerData.get(t.creditCardIssuer);

      if (existing) {
        existing.dueDays.push(dueDay);
        existing.count += 1;
        if (new Date(t.paymentDate) > new Date(existing.lastDate)) {
          existing.lastDate = t.paymentDate;
        }
      } else {
        issuerData.set(t.creditCardIssuer, {
          dueDays: [dueDay],
          lastDate: t.paymentDate,
          count: 1
        });
      }
    }
  });

  // 3. Calculate most common due day for each issuer
  const result: CreditCardInfo[] = [];

  issuerData.forEach((data, issuer) => {
    // Find most frequent due day
    const dayFrequency = new Map<number, number>();
    data.dueDays.forEach(day => {
      dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
    });

    let mostCommonDay = data.dueDays[0];
    let maxFrequency = 0;

    dayFrequency.forEach((freq, day) => {
      if (freq > maxFrequency) {
        maxFrequency = freq;
        mostCommonDay = day;
      }
    });

    result.push({
      issuer,
      mostCommonDueDay: mostCommonDay,
      lastInvoiceDate: data.lastDate,
      transactionCount: data.count
    });
  });

  // Sort by transaction count (most used cards first)
  return result.sort((a, b) => b.transactionCount - a.transactionCount);
};

/**
 * Suggests a due date for a credit card based on history
 * Returns suggested date in ISO format (YYYY-MM-DD)
 */
export const suggestCreditCardDueDate = (issuer: string): string | null => {
  const cards = getCreditCardHistory();
  const card = cards.find(c => c.issuer.toLowerCase() === issuer.toLowerCase());

  if (!card) return null;

  // Calculate next occurrence of the due day
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  // If the due day hasn't passed this month, use current month
  // Otherwise, use next month
  let targetMonth = currentMonth;
  let targetYear = currentYear;

  if (currentDay >= card.mostCommonDueDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const suggestedDate = new Date(targetYear, targetMonth, card.mostCommonDueDay);
  return suggestedDate.toISOString().split('T')[0];
};