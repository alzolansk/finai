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

export const isInvoiceAlreadyImported = (fingerprint: string): ImportedInvoice | null => {
  const invoices = getImportedInvoices();
  return invoices.find(inv => inv.fingerprint === fingerprint) || null;
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