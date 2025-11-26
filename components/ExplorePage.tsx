import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Transaction, TransactionType, Category, AdvancedFilter } from '../types';
import { Search, Filter, X, Save, Trash2, Calendar, DollarSign, Tag, Building2, FileText, ArrowUpDown, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { fuzzyMatch } from '../utils/searchUtils';
import { getIconForTransaction } from '../utils/iconMapper';
import { formatDate } from '../utils/dateUtils';

interface ExplorePageProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ transactions, onDelete, onUpdateTransaction }) => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [dateFieldMode, setDateFieldMode] = useState<'payment' | 'purchase'>('payment');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);
  const [selectedIssuers, setSelectedIssuers] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);

  // View mode (itemized vs grouped by invoices)
  const [viewMode, setViewMode] = useState<'itemized' | 'invoices'>('itemized');
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<AdvancedFilter[]>(() => {
    const saved = localStorage.getItem('finai_saved_filters');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Tag management
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [newTag, setNewTag] = useState('');
  const [reimbursedBy, setReimbursedBy] = useState('');

  // Get unique values for filter dropdowns
  const allIssuers = useMemo(() => {
    const issuers = new Set<string>();
    transactions.forEach(t => {
      if (t.issuer) issuers.add(t.issuer);
      if (t.creditCardIssuer) issuers.add(t.creditCardIssuer);
    });
    return Array.from(issuers).sort();
  }, [transactions]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    transactions.forEach(t => {
      t.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [transactions]);

  // Quick filter presets
  const quickFilters = [
    { label: 'Este Mês', action: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateRangeStart(start.toISOString().split('T')[0]);
      setDateRangeEnd(new Date().toISOString().split('T')[0]);
    }},
    { label: 'Últimos 30d', action: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setDateRangeStart(start.toISOString().split('T')[0]);
      setDateRangeEnd(end.toISOString().split('T')[0]);
    }},
    { label: 'Últimos 90d', action: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      setDateRangeStart(start.toISOString().split('T')[0]);
      setDateRangeEnd(end.toISOString().split('T')[0]);
    }},
    { label: 'Limpar Datas', action: () => {
      setDateRangeStart('');
      setDateRangeEnd('');
    }}
  ];

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Search query with fuzzy match
      if (searchQuery && !fuzzyMatch(t.description, searchQuery, 0.6)) {
        return false;
      }

      // Date range
      const baseDateValue = dateFieldMode === 'payment' ? (t.paymentDate || t.date) : t.date;
      const tDate = new Date(baseDateValue);
      if (dateRangeStart && tDate < new Date(dateRangeStart)) return false;
      if (dateRangeEnd && tDate > new Date(dateRangeEnd)) return false;

      // Categories
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false;

      // Amount range
      if (minAmount !== '' && t.amount < minAmount) return false;
      if (maxAmount !== '' && t.amount > maxAmount) return false;

      // Transaction types
      if (selectedTypes.length > 0 && !selectedTypes.includes(t.type)) return false;

      // Issuers
      if (selectedIssuers.length > 0) {
        const hasIssuer = selectedIssuers.some(issuer =>
          t.issuer === issuer || t.creditCardIssuer === issuer
        );
        if (!hasIssuer) return false;
      }

      // Tags
      if (selectedTags.length > 0) {
        const hasTags = selectedTags.some(tag => t.tags?.includes(tag));
        if (!hasTags) return false;
      }

      // Status filters
      if (selectedStatus.length > 0) {
        const matchesStatus = selectedStatus.some(status => {
          if (status === 'recorrente' && !t.isRecurring) return false;
          if (status === 'parcelado' && !/\(\d+\/\d+\)/.test(t.description)) return false;
          return true;
        });
        if (!matchesStatus) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, dateRangeStart, dateRangeEnd, selectedCategories, minAmount, maxAmount, selectedTypes, selectedIssuers, selectedTags, selectedStatus, dateFieldMode]);

  // Save current filter
  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: AdvancedFilter = {
      id: crypto.randomUUID(),
      name: filterName,
      dateRange: dateRangeStart || dateRangeEnd ? { start: dateRangeStart, end: dateRangeEnd } : undefined,
      dateField: dateFieldMode,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      minAmount: minAmount !== '' ? minAmount : undefined,
      maxAmount: maxAmount !== '' ? maxAmount : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      issuers: selectedIssuers.length > 0 ? selectedIssuers : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      status: selectedStatus.length > 0 ? selectedStatus as any : undefined,
      createdAt: Date.now()
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('finai_saved_filters', JSON.stringify(updated));
    setFilterName('');
    setShowSaveDialog(false);
  };

  // Load saved filter
  const loadFilter = (filter: AdvancedFilter) => {
    setDateRangeStart(filter.dateRange?.start || '');
    setDateRangeEnd(filter.dateRange?.end || '');
    setDateFieldMode(filter.dateField || 'payment');
    setSelectedCategories(filter.categories || []);
    setMinAmount(filter.minAmount ?? '');
    setMaxAmount(filter.maxAmount ?? '');
    setSelectedTypes(filter.types || []);
    setSelectedIssuers(filter.issuers || []);
    setSelectedTags(filter.tags || []);
    setSelectedStatus(filter.status || []);
  };

  // Delete saved filter
  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('finai_saved_filters', JSON.stringify(updated));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setSelectedCategories([]);
    setMinAmount('');
    setMaxAmount('');
    setSelectedTypes([]);
    setSelectedIssuers([]);
    setSelectedTags([]);
    setSelectedStatus([]);
    setDateFieldMode('payment');
  };

  // Tag management
  const openTagDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setReimbursedBy(transaction.reimbursedBy || '');
    setShowTagDialog(true);
  };

  const toggleReimbursable = () => {
    if (!selectedTransaction) return;

    const updatedTransaction = {
      ...selectedTransaction,
      isReimbursable: !selectedTransaction.isReimbursable,
      reimbursedBy: !selectedTransaction.isReimbursable ? reimbursedBy : undefined
    };

    onUpdateTransaction(updatedTransaction);
    setSelectedTransaction(updatedTransaction);
  };

  const updateReimbursedBy = () => {
    if (!selectedTransaction || !selectedTransaction.isReimbursable) return;

    const updatedTransaction = {
      ...selectedTransaction,
      reimbursedBy: reimbursedBy.trim() || undefined
    };

    onUpdateTransaction(updatedTransaction);
    setSelectedTransaction(updatedTransaction);
  };

  const addTag = () => {
    if (!selectedTransaction || !newTag.trim()) return;

    const updatedTransaction = {
      ...selectedTransaction,
      tags: [...(selectedTransaction.tags || []), newTag.trim()]
    };

    onUpdateTransaction(updatedTransaction);
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    if (!selectedTransaction) return;

    const updatedTransaction = {
      ...selectedTransaction,
      tags: selectedTransaction.tags?.filter(t => t !== tag)
    };

    onUpdateTransaction(updatedTransaction);
  };

  const activeFilterCount = [
    searchQuery,
    dateRangeStart,
    dateRangeEnd,
    ...selectedCategories,
    minAmount !== '' ? 1 : 0,
    maxAmount !== '' ? 1 : 0,
    ...selectedTypes,
    ...selectedIssuers,
    ...selectedTags,
    ...selectedStatus,
    dateFieldMode !== 'payment' ? 'dateField' : null
  ].filter(Boolean).length;

  // Toggle functions for invoice view
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

  // Group transactions by issuer and invoice (payment date)
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

  return (
    <div className="animate-fadeIn pb-20">
      <div className="mb-6">
        <h2 className="text-3xl font-light text-zinc-800 mb-2">Explorar</h2>
        <p className="text-zinc-500 text-sm">Busca avançada e filtros customizados</p>
      </div>

      {/* Search and Quick Actions */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-4">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Busca inteligente (ex: uber, nubank, alimentação)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
              showFilters
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Filter size={18} />
            Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter, idx) => (
            <button
              key={idx}
              onClick={filter.action}
              className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-xs rounded-lg transition-all"
            >
              {filter.label}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs rounded-lg transition-all flex items-center gap-1"
            >
              <X size={12} />
              Limpar Tudo
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-4 animate-slideUp">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Date Range */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <Calendar size={12} className="inline mr-1" />
                  Período
                </label>
                <div className="inline-flex bg-zinc-100 rounded-lg p-0.5 text-[11px] font-medium text-zinc-600">
                  <button
                    type="button"
                    onClick={() => setDateFieldMode('payment')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      dateFieldMode === 'payment'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Vencimento
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFieldMode('purchase')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      dateFieldMode === 'purchase'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Compra
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <DollarSign size={12} className="inline mr-1" />
                Valor (R$)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                <input
                  type="number"
                  placeholder="Máximo"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <ArrowUpDown size={12} className="inline mr-1" />
                Tipo
              </label>
              <div className="flex gap-2">
                {[TransactionType.EXPENSE, TransactionType.INCOME].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedTypes(prev =>
                        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                      );
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedTypes.includes(type)
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {type === TransactionType.EXPENSE ? 'Despesa' : 'Receita'}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <FileText size={12} className="inline mr-1" />
                Categorias
              </label>
              <div className="flex flex-wrap gap-1">
                {Object.values(Category).slice(0, 6).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      );
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      selectedCategories.includes(cat)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Issuers */}
            {allIssuers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  <Building2 size={12} className="inline mr-1" />
                  Bancos/Cartões
                </label>
                <div className="flex flex-wrap gap-1">
                  {allIssuers.slice(0, 4).map(issuer => (
                    <button
                      key={issuer}
                      onClick={() => {
                        setSelectedIssuers(prev =>
                          prev.includes(issuer) ? prev.filter(i => i !== issuer) : [...prev, issuer]
                        );
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        selectedIssuers.includes(issuer)
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {issuer}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  <Tag size={12} className="inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-1">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        selectedTags.includes(tag)
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save Filter Button */}
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-all flex items-center gap-2"
            >
              <Save size={16} />
              Salvar Filtro
            </button>
          </div>
        </div>
      )}

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Star size={14} />
            Filtros Salvos
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedFilters.map(filter => (
              <div key={filter.id} className="flex items-center gap-2 bg-zinc-50 px-3 py-2 rounded-lg group">
                <button
                  onClick={() => loadFilter(filter)}
                  className="text-sm text-zinc-700 hover:text-emerald-600 font-medium"
                >
                  {filter.name}
                </button>
                <button
                  onClick={() => deleteSavedFilter(filter.id)}
                  className="text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-800">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'resultado' : 'resultados'}
          </h3>

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
              Por Faturas
            </button>
          </div>
        </div>

        <div className="divide-y divide-zinc-100">
          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center text-zinc-400">
              Nenhuma transação encontrada com os filtros aplicados
            </div>
          ) : viewMode === 'itemized' ? (
            filteredTransactions.map(t => {
              const iconConfig = getIconForTransaction(t.description, t.category);
              const IconComponent = iconConfig.icon;
              const baseDateValue = dateFieldMode === 'payment' ? (t.paymentDate || t.date) : t.date;
              const dateLabel = dateFieldMode === 'payment' ? 'Vencimento' : 'Compra';

              return (
                <div key={t.id} className="p-6 hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        t.type === TransactionType.INCOME ? 'bg-emerald-100' : iconConfig.bgColor
                      }`}>
                        <IconComponent size={24} className={
                          t.type === TransactionType.INCOME ? 'text-emerald-600' : iconConfig.iconColor
                        } />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-zinc-800">{t.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-medium uppercase">
                            {t.category}
                          </span>
                          <span className="text-xs text-zinc-400">{dateLabel}: {formatDate(baseDateValue)}</span>
                          {t.isReimbursable && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                              💰 {t.reimbursedBy || 'Reembolsável'}
                            </span>
                          )}
                          {t.tags && t.tags.length > 0 && (
                            <div className="flex gap-1">
                              {t.tags.map(tag => (
                                <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-medium">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-bold text-lg ${
                        t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-zinc-900'
                      }`}>
                        {t.type === TransactionType.EXPENSE && '- '}
                        R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => openTagDialog(t)}
                        className="p-2 text-zinc-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Adicionar Tags"
                      >
                        <Tag size={18} />
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // Invoice/Grouped View
            issuerGroups.length === 0 ? (
              <div className="p-10 text-center text-zinc-400">
                Nenhuma fatura encontrada para despesas
              </div>
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
                            {group.invoices.length} {group.invoices.length === 1 ? 'fatura' : 'faturas'} • {group.itemCount}{' '}
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
                                <div className="bg-zinc-50/80 border-t border-zinc-100 divide-y divide-zinc-100">
                                  {invoice.transactions.map((t) => {
                                    const iconConfig = getIconForTransaction(t.description, t.category);
                                    const IconComponent = iconConfig.icon;

                                    return (
                                      <div key={t.id} className="p-6 pl-20 hover:bg-white transition-colors group">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconConfig.bgColor}`}>
                                              <IconComponent size={20} className={iconConfig.iconColor} />
                                            </div>
                                            <div className="flex-1">
                                              <p className="font-bold text-zinc-800 text-sm">{t.description}</p>
                                              <div className="flex items-center gap-2 mt-1">
                                                <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] text-zinc-500 font-medium uppercase">
                                                  {t.category}
                                                </span>
                                                {t.tags && t.tags.length > 0 && (
                                                  <div className="flex gap-1">
                                                    {t.tags.map(tag => (
                                                      <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-medium">
                                                        {tag}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="font-bold text-base text-zinc-900">
                                              R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <button
                                              onClick={() => openTagDialog(t)}
                                              className="p-2 text-zinc-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                              title="Adicionar Tags"
                                            >
                                              <Tag size={16} />
                                            </button>
                                            <button
                                              onClick={() => onDelete(t.id)}
                                              className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                              title="Excluir"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
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
            )
          )}
        </div>
      </div>

      {/* Save Filter Dialog - Using Portal */}
      {showSaveDialog && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-scaleIn">
            <h3 className="text-lg font-bold text-zinc-800 mb-4">Salvar Filtro</h3>
            <input
              type="text"
              placeholder="Nome do filtro..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveCurrentFilter}
                disabled={!filterName.trim()}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tag Dialog - Using Portal */}
      {showTagDialog && selectedTransaction && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-scaleIn max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-800 mb-2">Gerenciar Transação</h3>
            <p className="text-sm text-zinc-500 mb-4">{selectedTransaction.description}</p>

            {/* Reimbursable Section */}
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-sm font-bold text-amber-900">Compra de Terceiro</label>
                  <p className="text-xs text-amber-700">Alguém usou seu cartão e vai te pagar depois</p>
                </div>
                <button
                  onClick={toggleReimbursable}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedTransaction.isReimbursable ? 'bg-amber-600' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      selectedTransaction.isReimbursable ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {selectedTransaction.isReimbursable && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                    Quem vai reembolsar?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome da pessoa..."
                      value={reimbursedBy}
                      onChange={(e) => setReimbursedBy(e.target.value)}
                      onBlur={updateReimbursedBy}
                      className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
                    />
                  </div>
                  {selectedTransaction.reimbursedBy && (
                    <p className="text-xs text-amber-600 mt-1 italic">
                      💰 {selectedTransaction.reimbursedBy} deve R$ {selectedTransaction.amount.toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Existing Tags */}
            {selectedTransaction.tags && selectedTransaction.tags.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Tags Atuais</label>
                <div className="flex flex-wrap gap-2">
                  {selectedTransaction.tags.map(tag => (
                    <div key={tag} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                      <span className="text-sm font-medium">{tag}</span>
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-blue-400 hover:text-blue-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Tag */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Adicionar Tag</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                />
                <button
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Tag size={18} />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowTagDialog(false);
                setSelectedTransaction(null);
                setNewTag('');
                setReimbursedBy('');
              }}
              className="w-full px-4 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 transition-all font-medium"
            >
              Fechar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ExplorePage;
