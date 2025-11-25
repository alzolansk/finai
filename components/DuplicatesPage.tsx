import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { AlertTriangle, CheckCircle, X, Eye, EyeOff } from 'lucide-react';
import { calculateSimilarity } from '../utils/searchUtils';
import { formatDate } from '../utils/dateUtils';
import { getIconForTransaction } from '../utils/iconMapper';

interface DuplicatesPageProps {
  transactions: Transaction[];
  onMarkAsDuplicate: (transactionId: string, originalId: string) => void;
  onIgnoreDuplicate: (transactionId: string) => void;
}

interface DuplicateGroup {
  original: Transaction;
  duplicates: Array<{
    transaction: Transaction;
    similarity: number;
    reasons: string[];
  }>;
}

const DuplicatesPage: React.FC<DuplicatesPageProps> = ({
  transactions,
  onMarkAsDuplicate,
  onIgnoreDuplicate
}) => {
  const [showIgnored, setShowIgnored] = useState(false);

  // Detect potential duplicates
  const duplicateGroups = useMemo(() => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    // Sort by date (newest first) to make newer transactions potential duplicates of older ones
    const sorted = [...transactions]
      .filter(t => !t.isDuplicate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sorted.forEach((transaction, index) => {
      if (processed.has(transaction.id)) return;

      const potentialDuplicates: Array<{
        transaction: Transaction;
        similarity: number;
        reasons: string[];
      }> = [];

      // Compare with older transactions
      for (let i = index + 1; i < sorted.length; i++) {
        const other = sorted[i];
        if (processed.has(other.id)) continue;

        const reasons: string[] = [];
        let isDuplicate = false;

        // Same amount
        if (Math.abs(transaction.amount - other.amount) < 0.01) {
          reasons.push('Mesmo valor');
          isDuplicate = true;
        }

        // Similar description
        const descSimilarity = calculateSimilarity(transaction.description, other.description);
        if (descSimilarity > 0.75) {
          reasons.push(`Descrição similar (${(descSimilarity * 100).toFixed(0)}%)`);
          isDuplicate = true;
        }

        // Same date or very close dates (within 3 days)
        const date1 = new Date(transaction.date);
        const date2 = new Date(other.date);
        const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 3) {
          reasons.push(`Datas próximas (${Math.floor(daysDiff)} dia${daysDiff === 1 ? '' : 's'})`);
          if (daysDiff === 0) {
            isDuplicate = true;
          }
        }

        // Same category and type
        if (transaction.category === other.category && transaction.type === other.type) {
          reasons.push('Mesma categoria e tipo');
        }

        // Same issuer
        if (transaction.issuer && other.issuer && transaction.issuer === other.issuer) {
          reasons.push('Mesmo emissor');
        }

        // If we have at least 2 matching criteria including amount, it's likely a duplicate
        if (isDuplicate && reasons.length >= 2) {
          potentialDuplicates.push({
            transaction: other,
            similarity: descSimilarity,
            reasons
          });
        }
      }

      // Only add to groups if there are potential duplicates
      if (potentialDuplicates.length > 0) {
        groups.push({
          original: transaction,
          duplicates: potentialDuplicates.sort((a, b) => b.similarity - a.similarity)
        });
        processed.add(transaction.id);
        potentialDuplicates.forEach(d => processed.add(d.transaction.id));
      }
    });

    return groups;
  }, [transactions]);

  const ignoredTransactions = useMemo(() => {
    return transactions.filter(t => t.ignoredReason);
  }, [transactions]);

  const markedDuplicates = useMemo(() => {
    return transactions.filter(t => t.isDuplicate);
  }, [transactions]);

  return (
    <div className="animate-fadeIn pb-20">
      <div className="mb-6">
        <h2 className="text-3xl font-light text-zinc-800 mb-2">Auditoria e Reconciliação</h2>
        <p className="text-zinc-500 text-sm">Detecte e gerencie transações duplicadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle size={20} className="text-orange-500" />
            <span className="text-sm text-zinc-500">Duplicatas Detectadas</span>
          </div>
          <p className="text-2xl font-bold text-zinc-800">
            {duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0)}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={20} className="text-emerald-500" />
            <span className="text-sm text-zinc-500">Já Marcadas</span>
          </div>
          <p className="text-2xl font-bold text-zinc-800">{markedDuplicates.length}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <EyeOff size={20} className="text-zinc-400" />
            <span className="text-sm text-zinc-500">Ignoradas</span>
          </div>
          <p className="text-2xl font-bold text-zinc-800">{ignoredTransactions.length}</p>
        </div>
      </div>

      {/* Show Ignored Toggle */}
      {ignoredTransactions.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className="px-4 py-2 bg-white rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all flex items-center gap-2"
          >
            {showIgnored ? <EyeOff size={16} /> : <Eye size={16} />}
            {showIgnored ? 'Ocultar' : 'Mostrar'} Ignoradas ({ignoredTransactions.length})
          </button>
        </div>
      )}

      {/* Duplicate Groups */}
      {duplicateGroups.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
          <h3 className="text-xl font-bold text-zinc-800 mb-2">Nenhuma Duplicata Detectada</h3>
          <p className="text-zinc-500">
            Suas transações estão limpas! O sistema detecta automaticamente possíveis duplicatas.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {duplicateGroups.map((group, groupIndex) => {
            const iconConfig = getIconForTransaction(group.original.description, group.original.category);
            const IconComponent = iconConfig.icon;

            return (
              <div key={group.original.id} className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
                {/* Original Transaction */}
                <div className="p-6 bg-emerald-50/50 border-b border-emerald-100">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      Transação Original (Manter)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        group.original.type === TransactionType.INCOME ? 'bg-emerald-100' : iconConfig.bgColor
                      }`}>
                        <IconComponent size={24} className={
                          group.original.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor
                        } />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">{group.original.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-medium uppercase">
                            {group.original.category}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatDate(group.original.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className={`font-bold text-lg ${
                      group.original.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'
                    }`}>
                      {group.original.type === TransactionType.EXPENSE && '- '}
                      R$ {group.original.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Potential Duplicates */}
                <div className="divide-y divide-zinc-100">
                  {group.duplicates.map((dup, dupIndex) => {
                    const dupIconConfig = getIconForTransaction(dup.transaction.description, dup.transaction.category);
                    const DupIconComponent = dupIconConfig.icon;

                    return (
                      <div key={dup.transaction.id} className="p-6 bg-orange-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={16} className="text-orange-500" />
                          <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                            Possível Duplicata
                          </span>
                          <span className="ml-auto text-xs text-orange-600 font-medium">
                            {(dup.similarity * 100).toFixed(0)}% similar
                          </span>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              dup.transaction.type === TransactionType.INCOME ? 'bg-emerald-100' : dupIconConfig.bgColor
                            }`}>
                              <DupIconComponent size={24} className={
                                dup.transaction.type === TransactionType.INCOME ? 'text-emerald-600' : dupIconConfig.iconColor
                              } />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-800">{dup.transaction.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-medium uppercase">
                                  {dup.transaction.category}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {formatDate(dup.transaction.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className={`font-bold text-lg ${
                            dup.transaction.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'
                          }`}>
                            {dup.transaction.type === TransactionType.EXPENSE && '- '}
                            R$ {dup.transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Reasons */}
                        <div className="bg-white rounded-xl p-3 mb-3">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Motivos da Detecção
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {dup.reasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => onMarkAsDuplicate(dup.transaction.id, group.original.id)}
                            className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-500 transition-all font-medium text-sm flex items-center justify-center gap-2"
                          >
                            <X size={16} />
                            Marcar como Duplicata
                          </button>
                          <button
                            onClick={() => onIgnoreDuplicate(dup.transaction.id)}
                            className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 transition-all font-medium text-sm"
                          >
                            Não é Duplicata
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ignored Transactions */}
      {showIgnored && ignoredTransactions.length > 0 && (
        <div className="mt-6 bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-800">Transações Ignoradas</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Estas transações foram marcadas como não duplicatas
            </p>
          </div>
          <div className="divide-y divide-zinc-100">
            {ignoredTransactions.map(t => {
              const iconConfig = getIconForTransaction(t.description, t.category);
              const IconComponent = iconConfig.icon;

              return (
                <div key={t.id} className="p-6 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        t.type === TransactionType.INCOME ? 'bg-emerald-100' : iconConfig.bgColor
                      }`}>
                        <IconComponent size={24} className={
                          t.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor
                        } />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">{t.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-medium uppercase">
                            {t.category}
                          </span>
                          <span className="text-xs text-zinc-500">{formatDate(t.date)}</span>
                          {t.ignoredReason && (
                            <span className="text-xs text-zinc-400 italic">• {t.ignoredReason}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className={`font-bold text-lg ${
                      t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'
                    }`}>
                      {t.type === TransactionType.EXPENSE && '- '}
                      R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicatesPage;
