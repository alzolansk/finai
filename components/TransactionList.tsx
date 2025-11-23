import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { Trash2, Search, ArrowLeft, CalendarDays, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onBack: () => void;
}

interface InvoiceGroup {
  paymentDate: string;
  transactions: Transaction[];
  total: number;
  isGrouped: boolean;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onBack }) => {
  const [filter, setFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (paymentDate: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(paymentDate)) {
      newExpanded.delete(paymentDate);
    } else {
      newExpanded.add(paymentDate);
    }
    setExpandedGroups(newExpanded);
  };

  // Group transactions by payment date
  const groupedTransactions = useMemo(() => {
    const filtered = transactions
      .filter(t =>
        t.description.toLowerCase().includes(filter.toLowerCase()) ||
        t.category.toLowerCase().includes(filter.toLowerCase())
      );

    // Group by payment date (or date if no payment date)
    const groups = new Map<string, Transaction[]>();

    filtered.forEach(t => {
      const key = t.paymentDate || t.date;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(t);
    });

    // Convert to array and create InvoiceGroup objects
    const invoiceGroups: InvoiceGroup[] = Array.from(groups.entries()).map(([paymentDate, txs]) => {
      // Only group if there are 2+ transactions with same payment date AND they're all expenses
      const allExpenses = txs.every(t => t.type === TransactionType.EXPENSE);
      const shouldGroup = txs.length >= 2 && allExpenses;

      return {
        paymentDate,
        transactions: txs.sort((a, b) => a.description.localeCompare(b.description)),
        total: txs.reduce((sum, t) => sum + (t.type === TransactionType.EXPENSE ? t.amount : -t.amount), 0),
        isGrouped: shouldGroup
      };
    });

    // Sort by payment date (most recent first)
    return invoiceGroups.sort((a, b) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }, [transactions, filter]);

  const renderTransaction = (t: Transaction, isNested: boolean = false) => {
    const effectiveDate = t.paymentDate || t.date;
    const differentDates = t.paymentDate && t.paymentDate !== t.date;

    return (
      <div
        key={t.id}
        className={`${isNested ? 'pl-16' : ''} p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors group ${isNested ? 'border-l-2 border-zinc-200' : ''}`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>
            {t.description.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-zinc-800">{t.description}</p>
            <div className="flex flex-col gap-1 text-xs mt-1">
              <div className="flex items-center gap-2">
                <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-medium uppercase tracking-wide">{t.category}</span>
                {!isNested && <span className="text-zinc-400">Compra: {formatDate(t.date)}</span>}
              </div>
              {differentDates && !isNested && (
                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                  <CalendarDays size={10} /> Pagamento: {formatDate(effectiveDate)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className={`font-bold text-lg ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'}`}>
            {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <button
            onClick={() => onDelete(t.id)}
            className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="Excluir"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white rounded-xl shadow-sm border border-zinc-100 hover:bg-zinc-50 text-zinc-600 transition-all">
           <ArrowLeft size={20} />
        </button>
        <div>
           <h2 className="text-3xl font-light text-zinc-800">Extrato Completo</h2>
           <p className="text-zinc-400 text-sm">Gerencie todos os seus registros.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        {/* Search Bar */}
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nome ou categoria..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900/5 outline-none transition-all text-zinc-700"
                />
            </div>
        </div>

        {/* List */}
        <div className="divide-y divide-zinc-100">
            {groupedTransactions.length === 0 ? (
                <div className="p-10 text-center text-zinc-400">Nenhuma transação encontrada.</div>
            ) : (
                groupedTransactions.map(group => {
                  if (group.isGrouped) {
                    const isExpanded = expandedGroups.has(group.paymentDate);
                    const invoiceDate = new Date(group.paymentDate);
                    const monthName = invoiceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    // Get issuer from first transaction in the group
                    const issuer = group.transactions[0]?.issuer;
                    const invoiceTitle = issuer ? `${issuer} - ${monthName}` : `Fatura ${monthName}`;

                    return (
                      <div key={group.paymentDate}>
                        {/* Invoice Header */}
                        <div
                          onClick={() => toggleGroup(group.paymentDate)}
                          className="p-6 flex items-center justify-between bg-gradient-to-r from-zinc-50 to-white hover:from-zinc-100 cursor-pointer transition-all border-b border-zinc-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center">
                              <FileText className="text-white" size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900">{invoiceTitle}</p>
                              <p className="text-xs text-zinc-500 mt-1">
                                {group.transactions.length} {group.transactions.length === 1 ? 'item' : 'itens'} • Vencimento: {formatDate(group.paymentDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-xl text-zinc-900">
                              R$ {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="text-zinc-400" size={20} />
                            ) : (
                              <ChevronRight className="text-zinc-400" size={20} />
                            )}
                          </div>
                        </div>

                        {/* Invoice Items (collapsed/expanded) */}
                        {isExpanded && (
                          <div className="bg-zinc-50/30">
                            {group.transactions.map(t => renderTransaction(t, true))}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Single transaction - render normally
                    return group.transactions.map(t => renderTransaction(t, false));
                  }
                })
            )}
        </div>
      </div>
    </div>
  );
};

export default TransactionList;