import React, { useState, useMemo } from 'react';
import { ArrowLeft, FileText, Trash2, AlertTriangle, Package, Calendar, DollarSign, Hash } from 'lucide-react';
import { getImportedInvoices, ImportedInvoice, deleteTransaction } from '../services/storageService';

interface ImportHistoryPageProps {
  onBack: () => void;
  onImportDeleted: () => void;
}

const ImportHistoryPage: React.FC<ImportHistoryPageProps> = ({ onBack, onImportDeleted }) => {
  const [imports, setImports] = useState<ImportedInvoice[]>(getImportedInvoices());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedImports = useMemo(() => {
    return [...imports].sort((a, b) => b.importedAt - a.importedAt);
  }, [imports]);

  const handleDeleteImport = (importItem: ImportedInvoice) => {
    if (!importItem.transactionIds || importItem.transactionIds.length === 0) {
      alert('Esta importação não possui transações rastreáveis. Não é possível reverter.');
      return;
    }

    const confirmMessage = `Tem certeza que deseja remover esta importação?\n\n` +
      `Emissor: ${importItem.issuer || 'Desconhecido'}\n` +
      `${importItem.transactionCount} transações serão excluídas\n` +
      `Total: R$ ${importItem.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Esta ação não pode ser desfeita.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingId(importItem.id);

    try {
      // Delete all transactions from this import
      let deletedCount = 0;
      importItem.transactionIds.forEach(transactionId => {
        try {
          deleteTransaction(transactionId);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete transaction ${transactionId}:`, e);
        }
      });

      // Remove the import record from the list
      const updatedImports = getImportedInvoices().filter(inv => inv.id !== importItem.id);
      localStorage.setItem('finai_imported_invoices', JSON.stringify(updatedImports));

      setImports(updatedImports);
      onImportDeleted(); // Notify parent to refresh transactions

      alert(`Importação removida com sucesso!\n${deletedCount} transações foram excluídas.`);
    } catch (e) {
      console.error('Error deleting import:', e);
      alert('Erro ao remover importação. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-3 bg-white rounded-xl shadow-sm border border-zinc-100 hover:bg-zinc-50 text-zinc-600 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-light text-zinc-800">Histórico de Importações</h2>
          <p className="text-zinc-400 text-sm">Gerencie e reverta importações anteriores.</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        {sortedImports.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 mb-4">
              <Package size={32} className="text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 mb-2">Nenhuma importação encontrada</h3>
            <p className="text-zinc-500 text-sm">
              As importações de faturas e extratos aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {sortedImports.map((importItem) => {
              const isDeleting = deletingId === importItem.id;
              const hasTransactionIds = importItem.transactionIds && importItem.transactionIds.length > 0;

              return (
                <div
                  key={importItem.id}
                  className={`p-6 hover:bg-zinc-50 transition-colors ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start justify-between gap-6">
                    {/* Import Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                        <FileText className="text-white" size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-zinc-900 text-lg">
                            {importItem.issuer || 'Importação Manual'}
                          </h3>
                          {!hasTransactionIds && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              Não rastreável
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-zinc-600">
                            <Calendar size={14} className="text-zinc-400" />
                            <div>
                              <span className="text-xs text-zinc-400 block">Importado em</span>
                              <span className="font-medium">
                                {new Date(importItem.importedAt).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-zinc-600">
                            <Hash size={14} className="text-zinc-400" />
                            <div>
                              <span className="text-xs text-zinc-400 block">Transações</span>
                              <span className="font-medium">{importItem.transactionCount}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-zinc-600">
                            <DollarSign size={14} className="text-zinc-400" />
                            <div>
                              <span className="text-xs text-zinc-400 block">Valor total</span>
                              <span className="font-medium">
                                R$ {importItem.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {importItem.dueDate && (
                          <div className="mt-2 text-xs text-zinc-500">
                            Vencimento: {new Date(importItem.dueDate).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteImport(importItem)}
                      disabled={!hasTransactionIds || isDeleting}
                      className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shrink-0 ${
                        hasTransactionIds
                          ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600'
                          : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                      }`}
                      title={hasTransactionIds ? 'Reverter importação' : 'Importação não pode ser revertida'}
                    >
                      <Trash2 size={16} />
                      {isDeleting ? 'Removendo...' : 'Reverter'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      {sortedImports.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 text-sm">Sobre a reversão de importações</h4>
              <p className="text-xs text-blue-700 mt-1">
                Ao reverter uma importação, todas as transações criadas por ela serão <strong>permanentemente excluídas</strong>.
                Esta ação não pode ser desfeita. Importações antigas podem não ser rastreáveis e não podem ser revertidas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportHistoryPage;
