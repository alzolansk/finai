import { Transaction, TransactionType, UserSettings } from '../types';

const TRANSACTIONS_KEY = 'finai_transactions';
const SETTINGS_KEY = 'finai_settings';

// --- Transactions ---

export const getTransactions = (): Transaction[] => {
  const stored = localStorage.getItem(TRANSACTIONS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
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