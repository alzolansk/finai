import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { Trash2, Search, ArrowLeft, CalendarDays, FileText, ChevronDown, ChevronRight, Building2, SlidersHorizontal, CheckCircle2, Circle, Calendar, ChevronLeft as ChevronLeftIcon } from 'lucide-react';
import { formatDate, projectRecurringTransactions, getMonthName } from '../utils/dateUtils';
import { getIconForTransaction } from '../utils/iconMapper';

type ViewMode = 'itemized' | 'invoices';
type FilterKey = 'installments' | 'transfers' | 'credit';

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
  const [visibilityFilters, setVisibilityFilters] = useState<Record<FilterKey, boolean>>({
    installments: true,
    transfers: true,
    credit: true
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // null means "All months"

  const filterOptions: { key: FilterKey; label: string; helper: string }[] = [
    { key: 'installments', label: 'Parcelas', helper: 'Compras divididas' },
    { key: 'transfers', label: 'Transferencias', helper: 'PIX/TED/entre contas' },
    { key: 'credit', label: 'Credito', helper: 'Compras no cartao' }
  ];

  const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

  const toggleVisibilityFilter = (key: FilterKey) => {
    setVisibilityFilters((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isInstallmentTransaction = (t: Transaction) => /\(\d+\/\d+\)/.test(t.description);

  const isTransferTransaction = (t: Transaction) => {
    if (t.movementType === 'internal_transfer') return true;
    const normalized = normalizeText(t.description);
    return /(pix|ted|doc|transferencia|resgate|aplicacao|poupan)/.test(normalized);
  };

  const isCreditPurchaseTransaction = (t: Transaction) => {
    if (t.type !== TransactionType.EXPENSE) return false;
    const hasIssuerFlag = Boolean(t.issuer || t.creditCardIssuer || t.linkedToInvoice);
    const hasDifferentPaymentDate =
      !!t.paymentDate &&
      !!t.date &&
      new Date(t.paymentDate).getTime() !== new Date(t.date).getTime();
    return hasIssuerFlag || hasDifferentPaymentDate;
  };

  // Include projected recurring transactions for the selected month
  const allTransactions = useMemo(() => {
    if (!selectedDate) {
      return transactions; // Show all transactions without projections when "All months" is selected
    }
    const projected = projectRecurringTransactions(transactions, selectedDate);
    return [...transactions, ...projected];
  }, [transactions, selectedDate]);

  const filteredTransactions = useMemo(
    () => {
      const normalizedQuery = normalizeText(filter || '');

      let result = allTransactions.filter((t) => {
        const normalizedDescription = normalizeText(t.description);
        const normalizedCategory = normalizeText(t.category);

        return (
          (normalizedDescription.includes(normalizedQuery) || normalizedCategory.includes(normalizedQuery)) &&
          (visibilityFilters.installments || !isInstallmentTransaction(t)) &&
          (visibilityFilters.transfers || !isTransferTransaction(t)) &&
          (visibilityFilters.credit || !isCreditPurchaseTransaction(t))
        );
      });

      // Apply month filter if a specific month is selected
      if (selectedDate) {
        result = result.filter((t) => {
          const tDate = new Date(t.paymentDate || t.date);
          return (
            tDate.getMonth() === selectedDate.getMonth() &&
            tDate.getFullYear() === selectedDate.getFullYear()
          );
        });
      }

      return result;
    },
    [allTransactions, filter, visibilityFilters, selectedDate]
  );

  const itemizedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort(
        (a, b) => {
          // Sort by payment date (most recent first)
          const dateA = new Date(a.paymentDate || a.date).getTime();
          const dateB = new Date(b.paymentDate || b.date).getTime();

          if (dateB !== dateA) {
            return dateB - dateA; // Sort by date descending
          }

          // If dates are equal, sort by createdAt timestamp (most recent insertion first)
          const aCreated = a.createdAt || 0;
          const bCreated = b.createdAt || 0;
          return bCreated - aCreated;
        }
      ),
    [filteredTransactions]
  );

  const handlePrevMonth = () => {
    if (!selectedDate) {
      setSelectedDate(new Date()); // Start with current month if "All months" was selected
    } else {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setSelectedDate(newDate);
    }
  };

  const handleNextMonth = () => {
    if (!selectedDate) {
      setSelectedDate(new Date()); // Start with current month if "All months" was selected
    } else {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setSelectedDate(newDate);
    }
  };

  const handleShowAllMonths = () => {
    setSelectedDate(null);
  };

  const issuerGroups = useMemo(() => {
    const expensesOnly = filteredTransactions.filter((t) => t.type === TransactionType.EXPENSE);
    const issuerMap = new Map<string, Map<string, Transaction[]>>();

    expensesOnly.forEach((t) => {
      const issuer = t.issuer || t.creditCardIssuer || 'Outros';
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
    const iconConfig = getIconForTransaction(t.description, t.category);
    const IconComponent = iconConfig.icon;
    const isProjected = t.isProjected || false;

    return (
      <div
        key={t.id}
        className={`${isNested ? 'pl-16' : ''} p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors group ${isNested ? 'border-l-2 border-zinc-200' : ''} ${isProjected ? 'bg-blue-50/30' : ''}`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-emerald-100' : iconConfig.bgColor}`}>
            <IconComponent size={24} className={t.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-zinc-800">{t.description}</p>
              {isProjected && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  Recorrente
                </span>
              )}
            </div>
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
          {!isProjected && (
            <button
              onClick={() => onDelete(t.id)}
              className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title="Excluir"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto pb-20">
      {/* Simplified Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-3 bg-white rounded-xl shadow-sm border border-zinc-100 hover:bg-zinc-50 text-zinc-600 transition-all">
           <ArrowLeft size={20} />
        </button>
        <div>
           <h2 className="text-3xl font-light text-zinc-800">Extrato Completo</h2>
           <p className="text-zinc-400 text-sm">Gerencie todos os seus registros.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        {/* Unified Control Bar */}
        <div className="p-6 border-b border-zinc-100 space-y-4">
            {/* Search + Month Selector */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar transação..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    />
                </div>

                {/* Compact Month Selector */}
                <div className="flex items-center gap-2">
                  {selectedDate && (
                    <button
                      onClick={handleShowAllMonths}
                      className="px-3 py-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors whitespace-nowrap"
                    >
                      Limpar
                    </button>
                  )}
                  <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden">
                    <button onClick={handlePrevMonth} className="p-3 hover:bg-zinc-100 transition-colors text-zinc-600">
                      <ChevronLeftIcon size={16} />
                    </button>
                    <div className="flex items-center gap-1.5 px-3 min-w-[120px] justify-center border-x border-zinc-200">
                      <Calendar size={14} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-zinc-800 capitalize">
                         {selectedDate ? getMonthName(selectedDate) : 'Todos'}
                      </span>
                    </div>
                    <button onClick={handleNextMonth} className="p-3 hover:bg-zinc-100 transition-colors text-zinc-600">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
            </div>

            {/* Compact Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Quick Filters */}
              <div className="flex items-center gap-2">
                {filterOptions.map((option) => {
                  const isActive = visibilityFilters[option.key];
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleVisibilityFilter(option.key)}
                      title={option.helper}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border border-transparent hover:bg-zinc-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {/* View Mode Toggle */}
              <div className="inline-flex bg-zinc-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('itemized')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'itemized'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Itemizado
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('invoices')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'invoices'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
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
