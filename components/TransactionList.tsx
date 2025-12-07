import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import {
  Trash2,
  Search,
  ArrowLeft,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronRight,
  Building2,
  Calendar,
  ChevronLeft as ChevronLeftIcon,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { formatDate, projectRecurringTransactions, getMonthName } from '../utils/dateUtils';
import { getIconForTransaction } from '../utils/iconMapper';

type ViewMode = 'itemized' | 'invoices';
type FilterKey = 'installments' | 'transfers' | 'credit';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate?: (transaction: Transaction) => void;
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

// Memoized transaction item component
const TransactionItem = React.memo(
  ({
    t,
    isNested,
    onDelete,
    onEdit
  }: {
    t: Transaction;
    isNested: boolean;
    onDelete: (id: string) => void;
    onEdit: (transaction: Transaction) => void;
  }) => {
    const effectiveDate = t.paymentDate || t.date;
    const differentDates = t.paymentDate && t.paymentDate !== t.date;
    const iconConfig = getIconForTransaction(t.description, t.category);
    const IconComponent = iconConfig.icon;
    const isProjected = t.isProjected || false;

    return (
      <div
        className={`${isNested ? 'pl-16' : ''} p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors group relative ${isNested ? 'border-l-2 border-zinc-200' : ''} ${isProjected ? 'bg-blue-50/30' : ''}`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-emerald-100' : iconConfig.bgColor}`}
          >
            <IconComponent
              size={24}
              className={t.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-zinc-800">
                {t.type === TransactionType.INCOME && t.debtor ? `${t.debtor} - ${t.description}` : t.description}
              </p>
              {isProjected && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  Recorrente
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs mt-1">
              <div className="flex items-center gap-2">
                <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 font-medium uppercase tracking-wide">
                  {t.category}
                </span>
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
        <div className="flex items-center gap-2">
          <span className={`font-bold text-lg ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'}`}>
            {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          {!isProjected && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto bg-white rounded-lg shadow-lg border border-zinc-200 p-1">
              <button
                onClick={() => onEdit(t)}
                className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                title="Editar"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => onDelete(t.id)}
                className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

TransactionItem.displayName = 'TransactionItem';

// Constants for pagination
const ITEMS_PER_PAGE = 30; // Reduzido de 50 para 30 para carregamento mais rápido
const INITIAL_ITEMS = 15; // Carrega apenas 15 itens inicialmente

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onUpdate, onBack }) => {
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('itemized');
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [visibilityFilters, setVisibilityFilters] = useState<Record<FilterKey, boolean>>({
    installments: true,
    transfers: true,
    credit: true
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS); // Inicia com menos itens
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Flag para primeira carga
  const listRef = useRef<HTMLDivElement>(null);

  // Load more items after initial render
  useEffect(() => {
    if (isInitialLoad) {
      // Após 100ms, carrega mais itens para melhor UX
      const timer = setTimeout(() => {
        setVisibleCount(ITEMS_PER_PAGE);
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad]);

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
      setVisibleCount(INITIAL_ITEMS); // Reset para carregamento inicial rápido
      setIsInitialLoad(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [filter]);

  const filterOptions: { key: FilterKey; label: string; helper: string }[] = [
    { key: 'installments', label: 'Parcelas', helper: 'Compras divididas' },
    { key: 'transfers', label: 'Transferencias', helper: 'PIX/TED/entre contas' },
    { key: 'credit', label: 'Credito', helper: 'Compras no cartao' }
  ];

  const normalizeText = useCallback(
    (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    []
  );

  const toggleIssuer = useCallback((issuer: string) => {
    setExpandedIssuers((prev) => {
      const next = new Set(prev);
      if (next.has(issuer)) {
        next.delete(issuer);
      } else {
        next.add(issuer);
      }
      return next;
    });
  }, []);

  const toggleInvoice = useCallback((issuer: string, paymentDate: string) => {
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
  }, []);

  const toggleVisibilityFilter = useCallback((key: FilterKey) => {
    setVisibilityFilters((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
    setVisibleCount(ITEMS_PER_PAGE); // Reset pagination on filter change
  }, []);

  const isInstallmentTransaction = useCallback((t: Transaction) => /\(\d+\/\d+\)/.test(t.description), []);

  const isTransferTransaction = useCallback(
    (t: Transaction) => {
      if (t.movementType === 'internal_transfer') return true;
      const normalized = normalizeText(t.description);
      return /(pix|ted|doc|transferencia|resgate|aplicacao|poupan)/.test(normalized);
    },
    [normalizeText]
  );

  const isCreditPurchaseTransaction = useCallback((t: Transaction) => {
    if (t.type !== TransactionType.EXPENSE) return false;
    const hasIssuerFlag = Boolean(t.issuer || t.creditCardIssuer || t.linkedToInvoice);
    const hasDifferentPaymentDate =
      !!t.paymentDate && !!t.date && new Date(t.paymentDate).getTime() !== new Date(t.date).getTime();
    return hasIssuerFlag || hasDifferentPaymentDate;
  }, []);

  // Include projected recurring transactions for the selected month
  const allTransactions = useMemo(() => {
    if (!selectedDate) {
      return transactions;
    }
    const projected = projectRecurringTransactions(transactions, selectedDate);
    return [...transactions, ...projected];
  }, [transactions, selectedDate]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = normalizeText(debouncedFilter || '');

    let result = allTransactions.filter((t) => {
      // Quick visibility filter checks first (cheaper)
      if (!visibilityFilters.installments && isInstallmentTransaction(t)) return false;
      if (!visibilityFilters.transfers && isTransferTransaction(t)) return false;
      if (!visibilityFilters.credit && isCreditPurchaseTransaction(t)) return false;

      // Text search (more expensive)
      if (normalizedQuery) {
        const normalizedDescription = normalizeText(t.description);
        const normalizedCategory = normalizeText(t.category);
        if (!normalizedDescription.includes(normalizedQuery) && !normalizedCategory.includes(normalizedQuery)) {
          return false;
        }
      }

      return true;
    });

    // Apply month filter if a specific month is selected
    if (selectedDate) {
      const targetMonth = selectedDate.getMonth();
      const targetYear = selectedDate.getFullYear();
      result = result.filter((t) => {
        const tDate = new Date(t.paymentDate || t.date);
        return tDate.getMonth() === targetMonth && tDate.getFullYear() === targetYear;
      });
    }

    return result;
  }, [
    allTransactions,
    debouncedFilter,
    visibilityFilters,
    selectedDate,
    normalizeText,
    isInstallmentTransaction,
    isTransferTransaction,
    isCreditPurchaseTransaction
  ]);

  const itemizedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.date).getTime();
        const dateB = new Date(b.paymentDate || b.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }),
    [filteredTransactions]
  );

  // Visible transactions (paginated)
  const visibleTransactions = useMemo(
    () => itemizedTransactions.slice(0, visibleCount),
    [itemizedTransactions, visibleCount]
  );

  const hasMore = visibleCount < itemizedTransactions.length;

  // Load more on scroll
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, itemizedTransactions.length));
    }
  }, [hasMore, itemizedTransactions.length]);

  useEffect(() => {
    const listElement = listRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => listElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handlePrevMonth = useCallback(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    } else {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setSelectedDate(newDate);
    }
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedDate]);

  const handleNextMonth = useCallback(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    } else {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setSelectedDate(newDate);
    }
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedDate]);

  const handleShowAllMonths = useCallback(() => {
    setSelectedDate(null);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  // Só calcula issuerGroups quando estiver no modo invoices (otimização de performance)
  const issuerGroups = useMemo(() => {
    // Se não estiver no modo invoices, retorna array vazio para evitar cálculo desnecessário
    if (viewMode !== 'invoices') return [];

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

      return { issuer, invoices, totalAmount, itemCount };
    });

    return groups.sort((a, b) => b.totalAmount - a.totalAmount || b.itemCount - a.itemCount);
  }, [filteredTransactions, viewMode]); // Adiciona viewMode como dependência

  const handleDelete = useCallback(
    (id: string) => {
      onDelete(id);
    },
    [onDelete]
  );

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date.split('T')[0],
      paymentDate: transaction.paymentDate ? transaction.paymentDate.split('T')[0] : transaction.date.split('T')[0],
      type: transaction.type
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTransaction || !onUpdate) return;

    const updatedTransaction: Transaction = {
      ...editingTransaction,
      description: editForm.description || editingTransaction.description,
      amount: editForm.amount !== undefined ? editForm.amount : editingTransaction.amount,
      category: (editForm.category || editingTransaction.category) as Category,
      date: editForm.date ? new Date(editForm.date + 'T00:00:00').toISOString() : editingTransaction.date,
      paymentDate: editForm.paymentDate ? new Date(editForm.paymentDate + 'T00:00:00').toISOString() : editingTransaction.paymentDate,
      type: (editForm.type || editingTransaction.type) as TransactionType,
      updatedAt: Date.now()
    };

    onUpdate(updatedTransaction);
    setEditingTransaction(null);
    setEditForm({});
  }, [editingTransaction, editForm, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingTransaction(null);
    setEditForm({});
  }, []);

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
          <h2 className="text-3xl font-light text-zinc-800">Extrato Completo</h2>
          <p className="text-zinc-400 text-sm">{filteredTransactions.length} resultados</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        {/* Control Bar */}
        <div className="p-6 border-b border-zinc-100 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-600">Período:</label>
              <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 transition-colors text-zinc-600">
                  <ChevronLeftIcon size={16} />
                </button>
                <div className="flex items-center gap-1.5 px-3 min-w-[120px] justify-center border-x border-zinc-200">
                  <Calendar size={14} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-zinc-800 capitalize">
                    {selectedDate ? getMonthName(selectedDate) : 'Todos'}
                  </span>
                </div>
                <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-100 transition-colors text-zinc-600">
                  <ChevronRight size={16} />
                </button>
              </div>
              {selectedDate && (
                <button
                  onClick={handleShowAllMonths}
                  className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <label className="text-xs font-bold text-zinc-600">Visualização:</label>
              <div className="inline-flex bg-zinc-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('itemized')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'itemized' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Itemizado
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('invoices')}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'invoices' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Faturas
                </button>
              </div>
            </div>
          </div>

          {/* Transaction Type Filters */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-zinc-600">Exibir:</label>
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        {/* List with scroll container */}
        <div ref={listRef} className="divide-y divide-zinc-100 max-h-[70vh] overflow-y-auto">
          {viewMode === 'itemized' ? (
            visibleTransactions.length === 0 ? (
              isInitialLoad ? (
                /* Skeleton loading durante carregamento inicial */
                <div className="animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-200 rounded-2xl"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
                        <div className="h-3 bg-zinc-100 rounded w-1/4"></div>
                      </div>
                      <div className="h-5 bg-zinc-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-zinc-400">Nenhuma transacao encontrada.</div>
              )
            ) : (
              <>
                {visibleTransactions.map((t) => (
                  <TransactionItem key={t.id} t={t} isNested={false} onDelete={handleDelete} onEdit={handleEdit} />
                ))}
                {hasMore && (
                  <div className="p-4 text-center">
                    <button
                      onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                      className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                    >
                      Carregar mais ({itemizedTransactions.length - visibleCount} restantes)
                    </button>
                  </div>
                )}
              </>
            )
          ) : issuerGroups.length === 0 ? (
            <div className="p-10 text-center text-zinc-400">Nenhuma fatura encontrada.</div>
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
                                  <p className="font-semibold text-zinc-800">Vencimento: {formatDate(invoice.paymentDate)}</p>
                                  <p className="text-xs text-zinc-500 mt-1">
                                    {invoice.transactions.length} {invoice.transactions.length === 1 ? 'item' : 'itens'}
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
                                {invoice.transactions.map((t) => (
                                  <TransactionItem key={t.id} t={t} isNested={true} onDelete={handleDelete} onEdit={handleEdit} />
                                ))}
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

      {/* Edit Modal - Optimized with portal-like behavior */}
      {editingTransaction && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          style={{
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={handleCancelEdit}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            style={{
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: '85vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Compact */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <Edit2 className="text-white" size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Transação</h3>
                  <p className="text-xs text-blue-100">Atualize os dados rapidamente</p>
                </div>
              </div>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="p-5 space-y-3.5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: Compra no supermercado"
                />
              </div>

              {/* Amount & Type - Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount || ''}
                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">Tipo</label>
                  <select
                    value={editForm.type || ''}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as TransactionType })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                  >
                    <option value={TransactionType.EXPENSE}>Despesa</option>
                    <option value={TransactionType.INCOME}>Receita</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Categoria</label>
                <select
                  value={editForm.category || ''}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Category })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  {Object.values(Category).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates - Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">Data da Compra</label>
                  <input
                    type="date"
                    value={editForm.date || ''}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">Pagamento</label>
                  <input
                    type="date"
                    value={editForm.paymentDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Footer - Compact */}
            <div className="bg-zinc-50 border-t border-zinc-200 px-5 py-3.5 flex gap-2.5">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 text-sm text-zinc-700 font-semibold hover:bg-zinc-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 text-sm text-white font-semibold hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                <Save size={16} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
