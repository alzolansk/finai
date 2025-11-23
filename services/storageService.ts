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