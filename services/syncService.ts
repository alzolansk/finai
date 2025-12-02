import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig';
import { Transaction, UserSettings, WishlistItem } from '../types';
import { SavingsReview, ImportedInvoice, AgendaChecklistEntry } from './storageService';

// Device ID for identifying this device
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('finai_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('finai_device_id', deviceId);
  }
  return deviceId;
};

// User ID - for now using a simple shared ID, can be replaced with auth later
const getUserId = (): string => {
  let userId = localStorage.getItem('finai_user_id');
  if (!userId) {
    // Generate a shareable user ID
    userId = `user_${Math.random().toString(36).substr(2, 12)}`;
    localStorage.setItem('finai_user_id', userId);
  }
  return userId;
};

// Set user ID (for syncing with another device)
export const setUserId = (id: string): void => {
  localStorage.setItem('finai_user_id', id);
  window.location.reload(); // Reload to reconnect with new user
};

// Get current user ID for sharing
export const getCurrentUserId = (): string => getUserId();

// Collection references
const getCollectionRef = (collectionName: string) => {
  if (!db) return null;
  return collection(db, 'users', getUserId(), collectionName);
};

// Listeners storage
const listeners: Map<string, Unsubscribe> = new Map();

// ============ TRANSACTIONS ============

export const syncTransactions = (
  onUpdate: (transactions: Transaction[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const colRef = getCollectionRef('transactions');
  if (!colRef) return null;

  const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
    const transactions: Transaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push({ ...doc.data(), id: doc.id } as Transaction);
    });
    // Sort by createdAt descending
    transactions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    onUpdate(transactions);
  });

  listeners.set('transactions', unsubscribe);
  return unsubscribe;
};

export const saveTransactionToCloud = async (transaction: Transaction): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('transactions');
  if (!colRef) return;

  await setDoc(doc(colRef, transaction.id), {
    ...transaction,
    _updatedAt: Date.now(),
    _updatedBy: getDeviceId()
  });
};

export const deleteTransactionFromCloud = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('transactions');
  if (!colRef) return;

  await deleteDoc(doc(colRef, id));
};

// ============ SETTINGS ============

export const syncSettings = (
  onUpdate: (settings: UserSettings | null) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const docRef = doc(db, 'users', getUserId(), 'config', 'settings');

  const unsubscribe = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as UserSettings);
    } else {
      onUpdate(null);
    }
  });

  listeners.set('settings', unsubscribe);
  return unsubscribe;
};

export const saveSettingsToCloud = async (settings: UserSettings): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const docRef = doc(db, 'users', getUserId(), 'config', 'settings');
  await setDoc(docRef, {
    ...settings,
    _updatedAt: Date.now(),
    _updatedBy: getDeviceId()
  });
};

// ============ WISHLIST ============

export const syncWishlist = (
  onUpdate: (items: WishlistItem[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const colRef = getCollectionRef('wishlist');
  if (!colRef) return null;

  const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
    const items: WishlistItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ ...doc.data(), id: doc.id } as WishlistItem);
    });
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    onUpdate(items);
  });

  listeners.set('wishlist', unsubscribe);
  return unsubscribe;
};

export const saveWishlistToCloud = async (item: WishlistItem): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('wishlist');
  if (!colRef) return;

  await setDoc(doc(colRef, item.id), {
    ...item,
    _updatedAt: Date.now(),
    _updatedBy: getDeviceId()
  });
};

export const deleteWishlistFromCloud = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('wishlist');
  if (!colRef) return;

  await deleteDoc(doc(colRef, id));
};

// ============ SAVINGS REVIEWS ============

export const syncSavingsReviews = (
  onUpdate: (reviews: SavingsReview[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const colRef = getCollectionRef('savingsReviews');
  if (!colRef) return null;

  const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
    const reviews: SavingsReview[] = [];
    snapshot.forEach((doc) => {
      reviews.push({ ...doc.data(), id: doc.id } as SavingsReview);
    });
    onUpdate(reviews);
  });

  listeners.set('savingsReviews', unsubscribe);
  return unsubscribe;
};

export const saveSavingsReviewToCloud = async (review: SavingsReview): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('savingsReviews');
  if (!colRef) return;

  await setDoc(doc(colRef, review.id), {
    ...review,
    _updatedAt: Date.now(),
    _updatedBy: getDeviceId()
  });
};

// ============ AGENDA CHECKLIST ============

export const syncAgendaChecklist = (
  onUpdate: (entries: AgendaChecklistEntry[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const colRef = getCollectionRef('agendaChecklist');
  if (!colRef) return null;

  const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
    const entries: AgendaChecklistEntry[] = [];
    snapshot.forEach((doc) => {
      entries.push(doc.data() as AgendaChecklistEntry);
    });
    onUpdate(entries);
  });

  listeners.set('agendaChecklist', unsubscribe);
  return unsubscribe;
};

export const saveAgendaChecklistToCloud = async (entry: AgendaChecklistEntry): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('agendaChecklist');
  if (!colRef) return;

  const docId = `${entry.targetId}_${entry.monthKey}`;
  await setDoc(doc(colRef, docId), entry);
};

export const deleteAgendaChecklistFromCloud = async (targetId: string, monthKey: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('agendaChecklist');
  if (!colRef) return;

  const docId = `${targetId}_${monthKey}`;
  await deleteDoc(doc(colRef, docId));
};

// ============ IMPORTED INVOICES ============

export const syncImportedInvoices = (
  onUpdate: (invoices: ImportedInvoice[]) => void
): Unsubscribe | null => {
  if (!isFirebaseConfigured() || !db) return null;

  const colRef = getCollectionRef('importedInvoices');
  if (!colRef) return null;

  const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
    const invoices: ImportedInvoice[] = [];
    snapshot.forEach((doc) => {
      invoices.push({ ...doc.data(), id: doc.id } as ImportedInvoice);
    });
    invoices.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
    onUpdate(invoices);
  });

  listeners.set('importedInvoices', unsubscribe);
  return unsubscribe;
};

export const saveImportedInvoiceToCloud = async (invoice: ImportedInvoice): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const colRef = getCollectionRef('importedInvoices');
  if (!colRef) return;

  await setDoc(doc(colRef, invoice.id), invoice);
};

// ============ BULK OPERATIONS ============

export const uploadAllDataToCloud = async (data: {
  transactions: Transaction[];
  settings: UserSettings | null;
  wishlist: WishlistItem[];
  savingsReviews: SavingsReview[];
  agendaChecklist: AgendaChecklistEntry[];
  importedInvoices: ImportedInvoice[];
}): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;

  const batch = writeBatch(db);
  const userId = getUserId();

  // Upload transactions
  data.transactions.forEach((t) => {
    const docRef = doc(db!, 'users', userId, 'transactions', t.id);
    batch.set(docRef, { ...t, _updatedAt: Date.now() });
  });

  // Upload settings
  if (data.settings) {
    const settingsRef = doc(db, 'users', userId, 'config', 'settings');
    batch.set(settingsRef, { ...data.settings, _updatedAt: Date.now() });
  }

  // Upload wishlist
  data.wishlist.forEach((w) => {
    const docRef = doc(db!, 'users', userId, 'wishlist', w.id);
    batch.set(docRef, { ...w, _updatedAt: Date.now() });
  });

  // Upload savings reviews
  data.savingsReviews.forEach((r) => {
    const docRef = doc(db!, 'users', userId, 'savingsReviews', r.id);
    batch.set(docRef, { ...r, _updatedAt: Date.now() });
  });

  // Upload agenda checklist
  data.agendaChecklist.forEach((e) => {
    const docId = `${e.targetId}_${e.monthKey}`;
    const docRef = doc(db!, 'users', userId, 'agendaChecklist', docId);
    batch.set(docRef, e);
  });

  // Upload imported invoices
  data.importedInvoices.forEach((i) => {
    const docRef = doc(db!, 'users', userId, 'importedInvoices', i.id);
    batch.set(docRef, i);
  });

  await batch.commit();
  console.log('✅ All data uploaded to cloud');
};

// ============ CLEANUP ============

export const unsubscribeAll = (): void => {
  listeners.forEach((unsubscribe) => unsubscribe());
  listeners.clear();
};

// ============ STATUS ============

export const isSyncEnabled = (): boolean => {
  // Desabilita sync no modo demo
  const isDemoMode = localStorage.getItem('finai_demo_mode') === 'true';
  if (isDemoMode) return false;
  
  return isFirebaseConfigured();
};
