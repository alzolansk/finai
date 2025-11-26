import { Transaction, TransactionType, Category } from '../types';

export interface ReimbursementIncome {
  id: string;
  description: string;
  amount: number;
  date: string; // Date when the reimbursement should be received (invoice payment date)
  category: Category;
  type: TransactionType;
  linkedTransactionId: string; // Reference to the original reimbursable transaction
  reimbursedBy: string; // Name of the person reimbursing
  isAiGenerated: boolean;
}

/**
 * Processes reimbursable transactions and generates income entries
 * for when the credit card invoice is paid
 */
export const generateReimbursementIncomes = (
  transactions: Transaction[],
  existingTransactions: Transaction[]
): ReimbursementIncome[] => {
  const reimbursementIncomes: ReimbursementIncome[] = [];

  // Find all reimbursable transactions on credit cards
  const reimbursableTransactions = transactions.filter(t =>
    t.isReimbursable &&
    t.reimbursedBy &&
    t.type === TransactionType.EXPENSE &&
    t.paymentDate && // Must have a payment date (invoice due date)
    (t.issuer || t.creditCardIssuer) // Must be on a credit card
  );

  reimbursableTransactions.forEach(transaction => {
    // Check if we already created an income for this transaction
    const alreadyExists = existingTransactions.some(t =>
      t.type === TransactionType.INCOME &&
      t.description.includes(transaction.reimbursedBy!) &&
      t.description.includes('Reembolso') &&
      // Match by amount and date
      t.amount === transaction.amount &&
      t.date === transaction.paymentDate
    );

    if (!alreadyExists) {
      const income: ReimbursementIncome = {
        id: `reimb-${transaction.id}`,
        description: `Reembolso: ${transaction.reimbursedBy} - ${transaction.description}`,
        amount: transaction.amount,
        date: transaction.paymentDate!, // Income occurs on invoice payment date
        category: Category.OTHER,
        type: TransactionType.INCOME,
        linkedTransactionId: transaction.id,
        reimbursedBy: transaction.reimbursedBy!,
        isAiGenerated: true
      };

      reimbursementIncomes.push(income);
    }
  });

  return reimbursementIncomes;
};

/**
 * Checks if a transaction is a reimbursement income that should be created
 */
export const shouldCreateReimbursementIncome = (
  transaction: Transaction,
  existingTransactions: Transaction[]
): boolean => {
  if (!transaction.isReimbursable || !transaction.reimbursedBy || !transaction.paymentDate) {
    return false;
  }

  // Check if income already exists
  const incomeExists = existingTransactions.some(t =>
    t.type === TransactionType.INCOME &&
    t.description.includes(transaction.reimbursedBy!) &&
    t.description.includes('Reembolso') &&
    t.amount === transaction.amount &&
    t.date === transaction.paymentDate
  );

  return !incomeExists;
};

/**
 * Creates a single reimbursement income for a transaction
 */
export const createReimbursementIncome = (transaction: Transaction): Transaction => {
  return {
    id: crypto.randomUUID(),
    description: `Reembolso: ${transaction.reimbursedBy} - ${transaction.description}`,
    amount: transaction.amount,
    date: transaction.paymentDate!, // Income occurs on invoice payment date
    category: Category.OTHER,
    type: TransactionType.INCOME,
    isAiGenerated: true,
    createdAt: Date.now()
  };
};

/**
 * Removes reimbursement incomes that are no longer needed
 * (e.g., when the original transaction is deleted or modified)
 */
export const cleanupOrphanedReimbursements = (
  transactions: Transaction[]
): string[] => {
  const reimbursableTransactionIds = new Set(
    transactions
      .filter(t => t.isReimbursable && t.reimbursedBy)
      .map(t => t.id)
  );

  const orphanedIds: string[] = [];

  transactions.forEach(t => {
    if (
      t.type === TransactionType.INCOME &&
      t.description.includes('Reembolso') &&
      t.isAiGenerated
    ) {
      // Try to find the original transaction
      // This is a heuristic - we check if there's a matching reimbursable transaction
      const hasMatchingReimbursable = transactions.some(original =>
        original.isReimbursable &&
        original.reimbursedBy &&
        original.amount === t.amount &&
        original.paymentDate === t.date &&
        t.description.includes(original.reimbursedBy)
      );

      if (!hasMatchingReimbursable) {
        orphanedIds.push(t.id);
      }
    }
  });

  return orphanedIds;
};
