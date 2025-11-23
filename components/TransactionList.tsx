import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { Trash2, Search, ArrowLeft, CalendarDays, FileText, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

type ViewMode = 'itemized' | 'invoices';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onBack: () => void;
}

interface IssuerInvoice {
  paymentDate: string;
  transactions: Transaction[];
  total: number;
}

interface IssuerGroup {
  issuer: string;
  invoices: IssuerInvoice[];
  totalAmount: number;
  itemCount: number;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onBack }) => {
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('itemized');
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const toggleIssuer = (issuer: string) => {
    setExpandedIssuers((prev) => {
      const next = new Set(prev);
      if (next.has(issuer)) {
        next.delete(issuer);
      } else {
        next.add(issuer);
      }
      return next;
    });
  };

  const toggleInvoice = (issuer: string, paymentDate: string) => {
    const key = `${issuer}-${paymentDate}`;
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(filter.toLowerCase()) ||
          t.category.toLowerCase().includes(filter.toLowerCase())
      ),
    [transactions, filter]
  );

  const itemizedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort(
        (a, b) =>
          new Date(b.paymentDate || b.date).getTime() - new Date(a.paymentDate || a.date).getTime()
      ),
    [filteredTransactions]
  );

  const issuerGroups = useMemo(() => {
    const expensesOnly = filteredTransactions.filter((t) => t.type === TransactionType.EXPENSE);
    const issuerMap = new Map<string, Map<string, Transaction[]>>();

    expensesOnly.forEach((t) => {
      const issuer = t.issuer || 'Outros';
      const paymentKey = t.paymentDate || t.date;

      if (!issuerMap.has(issuer)) {
        issuerMap.set(issuer, new Map());
      }

      const invoiceMap = issuerMap.get(issuer)!;
      if (!invoiceMap.has(paymentKey)) {
        invoiceMap.set(paymentKey, []);
      }

      invoiceMap.get(paymentKey)!.push(t);
    });

    const groups: IssuerGroup[] = Array.from(issuerMap.entries()).map(([issuer, invoicesMap]) => {
      const invoices: IssuerInvoice[] = Array.from(invoicesMap.entries())
        .map(([paymentDate, txs]) => {
          const sortedTransactions = [...txs].sort((a, b) => a.description.localeCompare(b.description));
          return {
            paymentDate,
            transactions: sortedTransactions,
            total: sortedTransactions.reduce((sum, t) => sum + t.amount, 0)
          };
        })
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const itemCount = invoices.reduce((sum, invoice) => sum + invoice.transactions.length, 0);

      return {
        issuer,
        invoices,
        totalAmount,
        itemCount
      };
    });

    return groups.sort((a, b) => b.totalAmount - a.totalAmount || b.itemCount - a.itemCount);
  }, [filteredTransactions]);

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
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 space-y-4">
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
            <div className="flex justify-center">
              <div className="inline-flex bg-zinc-100 rounded-full p-1 shadow-inner text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('itemized')}
                  className={`px-5 py-2 rounded-full transition-all ${viewMode === 'itemized' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Itemizado
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('invoices')}
                  className={`px-5 py-2 rounded-full transition-all ${viewMode === 'invoices' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Faturas
                </button>
              </div>
            </div>
        </div>

        {/* List */}
        <div className="divide-y divide-zinc-100">
          {viewMode === 'itemized' ? (
            itemizedTransactions.length === 0 ? (
              <div className="p-10 text-center text-zinc-400">Nenhuma transacao encontrada.</div>
            ) : (
              itemizedTransactions.map((t) => renderTransaction(t, false))
            )
          ) : issuerGroups.length === 0 ? (
            <div className="p-10 text-center text-zinc-400">Nenhuma fatura encontrada para as transacoes filtradas.</div>
          ) : (
            issuerGroups.map((group) => {
              const isIssuerOpen = expandedIssuers.has(group.issuer);
              return (
                <div key={group.issuer} className="bg-white">
                  <button
                    type="button"
                    onClick={() => toggleIssuer(group.issuer)}
                    className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center">
                        <Building2 className="text-white" size={22} />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{group.issuer}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {group.invoices.length} {group.invoices.length === 1 ? 'fatura' : 'faturas'} - {group.itemCount}{' '}
                          {group.itemCount === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-xl text-zinc-900">
                        R$ {group.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {isIssuerOpen ? (
                        <ChevronDown className="text-zinc-400" size={20} />
                      ) : (
                        <ChevronRight className="text-zinc-400" size={20} />
                      )}
                    </div>
                  </button>

                  {isIssuerOpen && (
                    <div className="bg-zinc-50/50 divide-y divide-zinc-100">
                      {group.invoices.map((invoice) => {
                        const invoiceKey = `${group.issuer}-${invoice.paymentDate}`;
                        const isInvoiceOpen = expandedInvoices.has(invoiceKey);
                        return (
                          <div key={invoice.paymentDate} className="bg-white/60">
                            <button
                              type="button"
                              onClick={() => toggleInvoice(group.issuer, invoice.paymentDate)}
                              className="w-full p-5 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center">
                                  <FileText className="text-zinc-500" size={18} />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-800">
                                    Vencimento: {formatDate(invoice.paymentDate)}
                                  </p>
                                  <p className="text-xs text-zinc-500 mt-1">
                                    {invoice.transactions.length}{' '}
                                    {invoice.transactions.length === 1 ? 'item' : 'itens'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-lg text-zinc-900">
                                  R$ {invoice.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                {isInvoiceOpen ? (
                                  <ChevronDown className="text-zinc-400" size={18} />
                                ) : (
                                  <ChevronRight className="text-zinc-400" size={18} />
                                )}
                              </div>
                            </button>

                            {isInvoiceOpen && (
                              <div className="bg-zinc-50/80 border-t border-zinc-100">
                                {invoice.transactions.map((t) => renderTransaction(t, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionList;
