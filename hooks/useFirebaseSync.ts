import { useEffect, useCallback, useRef } from 'react';
import { Transaction, UserSettings, WishlistItem } from '../types';
import {
  syncTransactions,
  syncSettings,
  syncWishlist,
  syncSavingsReviews,
  syncAgendaChecklist,
  syncImportedInvoices,
  saveTransactionToCloud,
  deleteTransactionFromCloud,
  saveSettingsToCloud,
  saveWishlistToCloud,
  deleteWishlistFromCloud,
  saveSavingsReviewToCloud,
  saveAgendaChecklistToCloud,
  deleteAgendaChecklistFromCloud,
  saveImportedInvoiceToCloud,
  uploadAllDataToCloud,
  unsubscribeAll,
  isSyncEnabled,
  getCurrentUserId,
  setUserId
} from '../services/syncService';
import {
  getTransactions,
  getUserSettings,
  getWishlistItems,
  getSavingsReviews,
  getAgendaChecklist,
  getImportedInvoices,
  SavingsReview,
  AgendaChecklistEntry,
  ImportedInvoice
} from '../services/storageService';

interface UseFirebaseSyncProps {
  onTransactionsUpdate?: (transactions: Transaction[]) => void;
  onSettingsUpdate?: (settings: UserSettings | null) => void;
  onWishlistUpdate?: (items: WishlistItem[]) => void;
}

export const useFirebaseSync = ({
  onTransactionsUpdate,
  onSettingsUpdate,
  onWishlistUpdate
}: UseFirebaseSyncProps = {}) => {
  const isInitialized = useRef(false);
  const syncEnabled = isSyncEnabled();

  // Initialize sync listeners
  useEffect(() => {
    if (!syncEnabled || isInitialized.current) return;

    isInitialized.current = true;

    // Set up listeners
    if (onTransactionsUpdate) {
      syncTransactions(onTransactionsUpdate);
    }

    if (onSettingsUpdate) {
      syncSettings(onSettingsUpdate);
    }

    if (onWishlistUpdate) {
      syncWishlist(onWishlistUpdate);
    }

    // Cleanup on unmount
    return () => {
      unsubscribeAll();
      isInitialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncEnabled]); // Remove callbacks from dependencies to prevent loop

  // Sync transaction to cloud
  const syncTransaction = useCallback(async (transaction: Transaction) => {
    if (!syncEnabled) return;
    try {
      await saveTransactionToCloud(transaction);
    } catch (error) {
      console.error('Failed to sync transaction:', error);
    }
  }, [syncEnabled]);

  // Delete transaction from cloud
  const removeTransaction = useCallback(async (id: string) => {
    if (!syncEnabled) return;
    try {
      await deleteTransactionFromCloud(id);
    } catch (error) {
      console.error('Failed to delete transaction from cloud:', error);
    }
  }, [syncEnabled]);

  // Sync settings to cloud
  const syncUserSettings = useCallback(async (settings: UserSettings) => {
    if (!syncEnabled) return;
    try {
      await saveSettingsToCloud(settings);
    } catch (error) {
      console.error('Failed to sync settings:', error);
    }
  }, [syncEnabled]);

  // Sync wishlist item to cloud
  const syncWishlistItem = useCallback(async (item: WishlistItem) => {
    if (!syncEnabled) return;
    try {
      await saveWishlistToCloud(item);
    } catch (error) {
      console.error('Failed to sync wishlist item:', error);
    }
  }, [syncEnabled]);

  // Delete wishlist item from cloud
  const removeWishlistItem = useCallback(async (id: string) => {
    if (!syncEnabled) return;
    try {
      await deleteWishlistFromCloud(id);
    } catch (error) {
      console.error('Failed to delete wishlist item from cloud:', error);
    }
  }, [syncEnabled]);

  // Sync savings review to cloud
  const syncSavingsReview = useCallback(async (review: SavingsReview) => {
    if (!syncEnabled) return;
    try {
      await saveSavingsReviewToCloud(review);
    } catch (error) {
      console.error('Failed to sync savings review:', error);
    }
  }, [syncEnabled]);

  // Sync agenda checklist entry
  const syncAgendaEntry = useCallback(async (entry: AgendaChecklistEntry, isDelete = false) => {
    if (!syncEnabled) return;
    try {
      if (isDelete) {
        await deleteAgendaChecklistFromCloud(entry.targetId, entry.monthKey);
      } else {
        await saveAgendaChecklistToCloud(entry);
      }
    } catch (error) {
      console.error('Failed to sync agenda entry:', error);
    }
  }, [syncEnabled]);

  // Sync imported invoice
  const syncImportedInvoice = useCallback(async (invoice: ImportedInvoice) => {
    if (!syncEnabled) return;
    try {
      await saveImportedInvoiceToCloud(invoice);
    } catch (error) {
      console.error('Failed to sync imported invoice:', error);
    }
  }, [syncEnabled]);

  // Upload all local data to cloud (initial sync)
  const uploadAllData = useCallback(async () => {
    if (!syncEnabled) return;
    try {
      await uploadAllDataToCloud({
        transactions: getTransactions(),
        settings: getUserSettings(),
        wishlist: getWishlistItems(),
        savingsReviews: getSavingsReviews(),
        agendaChecklist: getAgendaChecklist(),
        importedInvoices: getImportedInvoices()
      });
    } catch (error) {
      console.error('Failed to upload all data:', error);
    }
  }, [syncEnabled]);

  // Connect to another user's data
  const connectToUser = useCallback((userId: string) => {
    setUserId(userId);
  }, []);

  return {
    syncEnabled,
    userId: getCurrentUserId(),
    syncTransaction,
    removeTransaction,
    syncUserSettings,
    syncWishlistItem,
    removeWishlistItem,
    syncSavingsReview,
    syncAgendaEntry,
    syncImportedInvoice,
    uploadAllData,
    connectToUser
  };
};

export default useFirebaseSync;
