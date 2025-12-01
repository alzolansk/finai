import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, UserSettings, WishlistItem, WishlistItemType, WishlistPriority, TransactionType, Category } from '../types';
import { Heart, Plus, Trash2, TrendingUp, Calendar, DollarSign, Sparkles, CheckCircle2, XCircle, AlertCircle, Edit2, Save, X, Loader2, HelpCircle, Info, ChevronRight, ChevronLeft, Plane, ShoppingBag, MapPin, Briefcase, Star, Filter as FilterIcon } from 'lucide-react';
import { researchWishlistItem, analyzeWishlistViability } from '../services/geminiService';
import { saveTransaction } from '../services/storageService';

interface WishlistTabProps {
  transactions: Transaction[];
  settings: UserSettings | null;
  wishlistItems: WishlistItem[];
  onAddItem: (item: WishlistItem) => void;
  onUpdateItem: (item: WishlistItem) => void;
  onDeleteItem: (id: string) => void;
}

type ConversationStep = 'idle' | 'name' | 'research' | 'payment' | 'installments' | 'analysis' | 'confirmation';

const WishlistTab: React.FC<WishlistTabProps> = ({
  transactions,
  settings,
  wishlistItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conversationStep, setConversationStep] = useState<ConversationStep>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | WishlistPriority.HIGH | WishlistPriority.MEDIUM | WishlistPriority.LOW>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'viable' | 'progress' | 'pending' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | WishlistItemType>('all');
  const [sortOption, setSortOption] = useState<'priority' | 'eta' | 'impact'>('priority');
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Conversation state
  const [itemName, setItemName] = useState('');
  const [researchResult, setResearchResult] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState<'cash' | 'installments'>('cash');
  const [installmentCount, setInstallmentCount] = useState(12);
  const [viabilityResult, setViabilityResult] = useState<any>(null);
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // Form state for manual editing
  const [formData, setFormData] = useState<Partial<WishlistItem>>({
    name: '',
    description: '',
    targetAmount: 0,
    savedAmount: 0,
    type: WishlistItemType.PURCHASE,
    priority: WishlistPriority.MEDIUM,
    targetDate: '',
    paymentOption: 'cash'
  });

  // Calculate monthly expenses with outlier detection and multiple scenarios
  const { monthlyIncome, monthlyExpenses, monthlySavingsPotential, expenseBreakdown, scenarios, dataQuality } = useMemo(() => {
    const income = settings?.monthlyIncome || 0;

    // Calculate average monthly expenses from recent months
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Count total transactions for quality assessment
    const totalTransactions = transactions.length;
    const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE').length;

    // Get last 6 months of data for better outlier detection
    const pastMonths = [0, 1, 2, 3, 4, 5].map(offset => {
      const date = new Date(currentYear, currentMonth - offset, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth()
      };
    });

    const pastMonthlyExpenseTotals = pastMonths.map(({ year, month }) => {
      return transactions
        .filter(t => {
          if (t.type !== 'EXPENSE') return false;
          const tDate = new Date(t.paymentDate || t.date);
          return tDate.getFullYear() === year && tDate.getMonth() === month;
        })
        .reduce((sum, t) => sum + t.amount, 0);
    });

    // Outlier detection using IQR method
    const detectOutliers = (values: number[]): { cleaned: number[], outliers: number[] } => {
      if (values.length < 3) return { cleaned: values, outliers: [] };

      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const cleaned: number[] = [];
      const outliers: number[] = [];

      values.forEach(v => {
        if (v >= lowerBound && v <= upperBound) {
          cleaned.push(v);
        } else {
          outliers.push(v);
        }
      });

      return { cleaned, outliers };
    };

    const { cleaned: cleanedExpenses } = detectOutliers(pastMonthlyExpenseTotals);

    // Use last 3 months average (without outliers) for realistic estimate
    const recentCleanedExpenses = cleanedExpenses.slice(0, Math.min(3, cleanedExpenses.length));
    const avgExpense = recentCleanedExpenses.length > 0
      ? recentCleanedExpenses.reduce((a, b) => a + b, 0) / recentCleanedExpenses.length
      : pastMonthlyExpenseTotals.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, pastMonthlyExpenseTotals.length);

    // Calculate recurring expenses baseline
    const recurringExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && t.isRecurring)
      .reduce((sum, t) => sum + t.amount, 0);

    // Use the higher of: average expense or recurring expenses (more realistic)
    const expenses = Math.max(avgExpense, recurringExpenses);
    const savingsPotential = income - expenses;

    // Calculate different scenarios
    const scenariosCalc = {
      conservative: {
        label: 'Conservador',
        savingsRate: 0.30,
        monthlyAmount: savingsPotential * 0.30,
        description: 'Poupa 30% do disponível (seguro)'
      },
      realistic: {
        label: 'Realista',
        savingsRate: 0.50,
        monthlyAmount: savingsPotential * 0.50,
        description: 'Poupa 50% do disponível (equilibrado)'
      },
      optimistic: {
        label: 'Otimista',
        savingsRate: 0.90,
        monthlyAmount: savingsPotential * 0.90,
        description: 'Poupa 90% do disponível (agressivo)'
      }
    };

    // Data quality assessment
    const qualityScore = (() => {
      let score = 0;
      let warnings: string[] = [];

      // Check transaction volume
      if (totalTransactions < 10) {
        warnings.push('Adicione mais transações para análises precisas (mínimo recomendado: 30)');
        score += 20;
      } else if (totalTransactions < 30) {
        warnings.push('Adicione mais transações para melhorar precisão das análises');
        score += 50;
      } else {
        score += 100;
      }

      // Check months of data
      if (recentCleanedExpenses.length < 2) {
        warnings.push('Registre despesas por pelo menos 2-3 meses para análises confiáveis');
        score += 20;
      } else if (recentCleanedExpenses.length < 3) {
        warnings.push('Continue registrando transações para melhorar a precisão');
        score += 60;
      } else {
        score += 100;
      }

      // Check if income is set
      if (income === 0) {
        warnings.push('Configure sua renda mensal nas configurações');
        score += 0;
      } else {
        score += 100;
      }

      const avgScore = score / 3;
      const level = avgScore >= 80 ? 'good' : avgScore >= 50 ? 'medium' : 'low';

      return { score: avgScore, level, warnings };
    })();

    return {
      monthlyIncome: income,
      monthlyExpenses: expenses,
      monthlySavingsPotential: savingsPotential,
      expenseBreakdown: {
        average: avgExpense,
        recurring: recurringExpenses,
        monthsAnalyzed: recentCleanedExpenses.length
      },
      scenarios: scenariosCalc,
      dataQuality: qualityScore
    };
  }, [transactions, settings]);

  // Start conversation
  const startConversation = () => {
    setIsAddingNew(true);
    setConversationStep('name');
    setItemName('');
    setResearchResult(null);
    setViabilityResult(null);
    setManualPrice(null);
  };

  // Handle name submission
  const handleNameSubmit = async () => {
    if (!itemName.trim()) return;

    setIsLoading(true);
    setConversationStep('research');

    try {
      const result = await researchWishlistItem(itemName);
      setResearchResult(result);
      setConversationStep('payment');
    } catch (error) {
      console.error('Research error:', error);
      setResearchResult({
        estimatedPrice: 0,
        priceRange: { min: 0, max: 0 },
        description: 'Não foi possível pesquisar automaticamente.',
        suggestions: [],
        confidence: 'low'
      });
      setConversationStep('payment');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle payment option selection
  const handlePaymentSelection = async (option: 'cash' | 'installments') => {
    setPaymentOption(option);

    if (option === 'installments') {
      setConversationStep('installments');
    } else {
      await analyzeAndFinish(option, undefined);
    }
  };

  // Handle installment selection
  const handleInstallmentSelection = async (count: number) => {
    setInstallmentCount(count);
    await analyzeAndFinish('installments', count);
  };

  // Analyze viability and finish
  const analyzeAndFinish = async (payment: 'cash' | 'installments', installments?: number) => {
    setIsLoading(true);
    setConversationStep('analysis');

    const targetAmount = manualPrice || researchResult?.estimatedPrice || 0;

    try {
      const result = await analyzeWishlistViability(
        itemName,
        targetAmount,
        monthlyIncome,
        monthlyExpenses,
        payment,
        installments
      );

      // Add data quality warning to analysis if needed
      if (dataQuality.level !== 'good') {
        result.analysis = `⚠️ Análise baseada em dados ${dataQuality.level === 'low' ? 'insuficientes' : 'limitados'}. ${result.analysis}`;
      }

      setViabilityResult(result);
      setConversationStep('confirmation');
    } catch (error) {
      console.error('Analysis error:', error);
      setConversationStep('confirmation');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm and add item
  const confirmAddItem = () => {
    const targetAmount = manualPrice || researchResult?.estimatedPrice || 0;

    const newItem: WishlistItem = {
      id: crypto.randomUUID(),
      name: itemName,
      description: researchResult?.description || '',
      targetAmount: targetAmount,
      savedAmount: 0,
      type: WishlistItemType.PURCHASE,
      priority: WishlistPriority.MEDIUM,
      paymentOption: paymentOption,
      installmentCount: paymentOption === 'installments' ? installmentCount : undefined,
      installmentAmount: paymentOption === 'installments' ? targetAmount / installmentCount : undefined,
      isViable: viabilityResult?.isViable || false,
      viabilityDate: viabilityResult?.viabilityDate,
      aiAnalysis: viabilityResult?.analysis || '',
      aiRecommendation: viabilityResult?.recommendation || '',
      priceResearchConfidence: researchResult?.confidence || 'low',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    onAddItem(newItem);
    handleCancel();
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setConversationStep('idle');
    setItemName('');
    setResearchResult(null);
    setViabilityResult(null);
    setEditingId(null);
    setManualPrice(null);
    setFormData({
      name: '',
      description: '',
      targetAmount: 0,
      savedAmount: 0,
      type: WishlistItemType.PURCHASE,
      priority: WishlistPriority.MEDIUM,
      targetDate: '',
      paymentOption: 'cash'
    });
  };

  // Navigate back in conversation
  const handleGoBack = () => {
    if (conversationStep === 'payment') {
      setConversationStep('name');
      setResearchResult(null);
    } else if (conversationStep === 'installments') {
      setConversationStep('payment');
    } else if (conversationStep === 'confirmation') {
      if (paymentOption === 'installments') {
        setConversationStep('installments');
      } else {
        setConversationStep('payment');
      }
      setViabilityResult(null);
    }
  };

  const motionStyles = `
    @keyframes wishlist-fade-slide {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  const toggleAnalysis = (id: string) => {
    setExpandedAnalyses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleControls = (id: string) => {
    setExpandedControls(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Inline updates for wishlist cards
  const updateSavedAmount = (item: WishlistItem, value: number) => {
    if (Number.isNaN(value)) return;
    const clamped = Math.max(0, Math.min(item.targetAmount, value));
    onUpdateItem({
      ...item,
      savedAmount: clamped,
      updatedAt: Date.now()
    });
  };

  const quickIncrement = (item: WishlistItem, delta: number) => {
    const next = (item.savedAmount || 0) + delta;
    updateSavedAmount(item, next);
  };

  const updatePriority = (item: WishlistItem, priority: WishlistPriority) => {
    onUpdateItem({
      ...item,
      priority,
      updatedAt: Date.now()
    });
  };

  const updateTargetDate = (item: WishlistItem, targetDate: string) => {
    onUpdateItem({
      ...item,
      targetDate,
      updatedAt: Date.now()
    });
  };

  const toggleArchive = (item: WishlistItem) => {
    onUpdateItem({
      ...item,
      isArchived: !item.isArchived,
      archivedAt: !item.isArchived ? Date.now() : undefined,
      updatedAt: Date.now()
    });
  };

  const convertToTransaction = (item: WishlistItem) => {
    const tx: Transaction = {
      id: crypto.randomUUID(),
      description: `Wishlist: ${item.name}`,
      amount: item.targetAmount,
      date: new Date().toISOString(),
      paymentDate: new Date().toISOString(),
      category: item.type === WishlistItemType.INVESTMENT ? Category.SAVINGS :
                item.type === WishlistItemType.EXPERIENCE ? Category.ENTERTAINMENT :
                item.type === WishlistItemType.PURCHASE ? Category.SHOPPING :
                Category.OTHER,
      type: TransactionType.EXPENSE,
      isAiGenerated: true
    };
    saveTransaction(tx);
    onUpdateItem({
      ...item,
      isArchived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  const getStatusBadge = (item: WishlistItem, progress: number) => {
    if (item.isViable) return { label: 'Viavel', color: 'bg-emerald-100 text-emerald-700' };
    if (progress > 50) return { label: 'Em progresso', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Aguardando renda', color: 'bg-zinc-100 text-zinc-700' };
  };

  const getTypeIcon = (type?: WishlistItemType) => {
    switch (type) {
      case WishlistItemType.TRAVEL:
        return { icon: <Plane size={18} />, color: 'bg-blue-100 text-blue-600' };
      case WishlistItemType.EXPERIENCE:
        return { icon: <Star size={16} />, color: 'bg-amber-100 text-amber-700' };
      case WishlistItemType.INVESTMENT:
        return { icon: <Briefcase size={16} />, color: 'bg-emerald-100 text-emerald-700' };
      case WishlistItemType.PURCHASE:
        return { icon: <ShoppingBag size={16} />, color: 'bg-purple-100 text-purple-700' };
      default:
        return { icon: <MapPin size={16} />, color: 'bg-zinc-100 text-zinc-600' };
    }
  };

  const getConfidenceLabel = (confidence?: string) => {
    if (confidence === 'high') return 'Alta';
    if (confidence === 'medium') return 'Media';
    return 'Baixa';
  };

  const getEtaMonths = (item: WishlistItem) => {
    const remaining = item.targetAmount - item.savedAmount;
    if (remaining <= 0 || monthlySavingsPotential <= 0) return null;
    return Math.ceil(remaining / monthlySavingsPotential);
  };

  const getMonthlyImpact = (item: WishlistItem) => {
    if (item.paymentOption === 'installments' && item.installmentAmount) {
      return item.installmentAmount;
    }
    const remaining = item.targetAmount - item.savedAmount;
    return monthlySavingsPotential > 0 ? Math.min(remaining, monthlySavingsPotential) : remaining;
  };

  const filteredItems = useMemo(() => {
    const priorityOrder = { [WishlistPriority.HIGH]: 3, [WishlistPriority.MEDIUM]: 2, [WishlistPriority.LOW]: 1 };
    const filtered = wishlistItems.filter(item => {
      const isArchived = !!item.isArchived;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const progress = (item.savedAmount / item.targetAmount) * 100;
      const matchesStatus =
        statusFilter === 'all'
          ? !isArchived
          : statusFilter === 'archived'
            ? isArchived
            : statusFilter === 'viable'
              ? (!isArchived && item.isViable)
              : statusFilter === 'progress'
                ? (!isArchived && !item.isViable && progress > 0)
                : (!isArchived && !item.isViable && progress === 0);
      return matchesSearch && matchesPriority && matchesType && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortOption === 'eta') {
        const etaA = getEtaMonths(a) ?? Number.POSITIVE_INFINITY;
        const etaB = getEtaMonths(b) ?? Number.POSITIVE_INFINITY;
        return etaA - etaB;
      }
      if (sortOption === 'impact') {
        const impactA = getMonthlyImpact(a);
        const impactB = getMonthlyImpact(b);
        return impactB - impactA;
      }
      // default priority
      return (priorityOrder[b.priority] - priorityOrder[a.priority]) || (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [wishlistItems, searchTerm, priorityFilter, typeFilter, statusFilter, sortOption, monthlySavingsPotential]);

  const filteredTotals = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + item.targetAmount, 0);
    const viable = filteredItems.filter(i => i.isViable).length;
    return {
      count: filteredItems.length,
      viable,
      totalAmount: total
    };
  }, [filteredItems]);

  const archivedItems = useMemo(() => wishlistItems.filter(i => i.isArchived), [wishlistItems]);
  const archivedMatches = useMemo(() =>
    wishlistItems.filter(i =>
      i.isArchived &&
      (searchTerm.trim() ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
    ).length,
  [wishlistItems, searchTerm]);

  return (
    <div className="space-y-8 pb-20 animate-fadeIn">
      <style>{motionStyles}</style>
      
      {/* Header - Desktop Version */}
      <div className="hidden md:flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-light text-zinc-800">
            Lista de Desejos
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Planeje seus objetivos com inteligência artificial</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className="p-3 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:border-emerald-200 hover:text-emerald-700 transition-all"
            title="Filtrar"
          >
            <FilterIcon size={18} />
          </button>
          <button
            onClick={isAddingNew ? handleCancel : startConversation}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              isAddingNew
                ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isAddingNew ? <X size={18} /> : <Plus size={18} />}
            {isAddingNew ? 'Cancelar' : 'Novo Desejo'}
          </button>
        </div>
      </div>
      
      {/* Header - Mobile Version */}
      <div className="md:hidden flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-light text-zinc-800">Lista de Desejos</h2>
          <p className="text-zinc-500 text-[10px] mt-0.5">Planeje seus objetivos com IA</p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className="p-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 active:border-emerald-200 active:text-emerald-700 transition-all"
            title="Filtrar"
          >
            <FilterIcon size={16} />
          </button>
          <button
            onClick={isAddingNew ? handleCancel : startConversation}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all ${
              isAddingNew
                ? 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                : 'bg-emerald-500 text-white active:bg-emerald-600 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isAddingNew ? <X size={16} /> : <Plus size={16} />}
            {isAddingNew ? 'Cancelar' : 'Novo'}
          </button>
        </div>
      </div>

      {/* Filters & Search (collapsible) */}
      {showFilters && (
        <div className="bg-white border border-zinc-100 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center md:items-end animate-fadeIn">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-zinc-500 mb-1 block">Buscar por nome</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ex.: viagem, notebook, curso..."
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
            {archivedMatches > 0 && statusFilter !== 'archived' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                Arquivados: {archivedMatches} encontrados
                <button
                  onClick={() => setStatusFilter('archived')}
                  className="text-emerald-700 font-semibold hover:text-emerald-800"
                  type="button"
                >
                  Ver arquivados
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1 block">Prioridade</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="all">Todas</option>
                <option value={WishlistPriority.HIGH}>Alta</option>
                <option value={WishlistPriority.MEDIUM}>Media</option>
                <option value={WishlistPriority.LOW}>Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="all">Todas</option>
                <option value="viable">Viavel</option>
                <option value="progress">Em progresso</option>
                <option value="pending">Aguardando renda</option>
                <option value="archived">Arquivadas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1 block">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="all">Todos</option>
                <option value={WishlistItemType.TRAVEL}>Viagem</option>
                <option value={WishlistItemType.EXPERIENCE}>Experiencia</option>
                <option value={WishlistItemType.INVESTMENT}>Investimento</option>
                <option value={WishlistItemType.PURCHASE}>Compra</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 mb-1 block">Ordenar por</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="priority">Prioridade</option>
                <option value="eta">Mais proximo (ETA)</option>
                <option value="impact">Impacto mensal</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Data Quality Warning */}
      {dataQuality.level !== 'good' && dataQuality.warnings.length > 0 && (
        <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 shadow-sm text-sm ${
          dataQuality.level === 'low'
            ? 'bg-rose-50 border border-rose-100'
            : 'bg-amber-50 border border-amber-100'
        }`}>
          <AlertCircle size={20} className={`mt-0.5 ${dataQuality.level === 'low' ? 'text-rose-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            <p className={`font-bold mb-1 ${dataQuality.level === 'low' ? 'text-rose-800' : 'text-amber-800'}`}>
              {dataQuality.level === 'low' ? '⚠️ Dados insuficientes' : '📊 Melhore a precisão das análises'}
            </p>
            <ul className={`space-y-1 text-xs ${dataQuality.level === 'low' ? 'text-rose-700' : 'text-amber-700'}`}>
              {dataQuality.warnings.map((warning, idx) => (
                <li key={idx}>• {warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Archived hint */}
      {(archivedMatches > 0 || statusFilter === 'archived') && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 shadow-sm text-sm">
          <div className="text-amber-800">
            {statusFilter === 'archived'
              ? `Listando arquivados (${archivedItems.length})`
              : `Arquivados: ${archivedMatches} encontrados`}
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
            className="text-sm font-bold text-amber-700 hover:text-amber-800"
          >
            {statusFilter === 'archived' ? 'Voltar' : 'Ver arquivados'}
          </button>
        </div>
      )}

      {/* Financial Summary - Desktop Version */}
      <div className="hidden md:grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign size={20} />
            </div>
            <h3 className="font-bold text-zinc-700 text-sm">Potencial de Economia</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            R$ {monthlySavingsPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Disponível por mês para poupar</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Heart size={20} />
            </div>
            <h3 className="font-bold text-zinc-700 text-sm">Seus Desejos</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{filteredTotals.count}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {filteredTotals.viable} viáveis no momento
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-bold text-zinc-700 text-sm">Valor Total</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            R$ {filteredTotals.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Soma de todos os desejos</p>
        </div>
      </div>
      
      {/* Financial Summary - Mobile Version */}
      <div className="md:hidden grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-emerald-50 rounded-md text-emerald-600">
              <DollarSign size={14} />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-900">
            R$ {monthlySavingsPotential.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Disponível/mês</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-blue-50 rounded-md text-blue-600">
              <Heart size={14} />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-900">{filteredTotals.count}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">{filteredTotals.viable} viáveis</p>
        </div>

        <div className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="p-1 bg-purple-50 rounded-md text-purple-600">
              <TrendingUp size={14} />
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-900">
            R$ {(filteredTotals.totalAmount / 1000).toFixed(0)}k
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Total</p>
        </div>
      </div>

      {/* Conversational Add Flow */}
      {isAddingNew && (
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-3xl p-8 text-white shadow-xl animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="text-emerald-400" size={24} />
              <h3 className="text-xl font-bold">Assistente IA - Novo Desejo</h3>
            </div>
            {/* Discrete cancel button */}
            <button
              onClick={handleCancel}
              className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              title="Cancelar e fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step 1: Name Input */}
          {conversationStep === 'name' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  O que você deseja alcançar? 🎯
                </label>
                <p className="text-xs text-zinc-400 mb-4">
                  Exemplos: "Galaxy Fold 6 512GB", "Viagem para Paris", "PlayStation 5", "Curso de inglês"
                </p>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  placeholder="Digite seu desejo..."
                  className="w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-lg"
                  autoFocus
                />
              </div>
              <button
                onClick={handleNameSubmit}
                disabled={!itemName.trim() || isLoading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ChevronRight size={20} />
                Continuar
              </button>
            </div>
          )}

          {/* Step 2: Research Loading */}
          {conversationStep === 'research' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fadeIn">
              <Loader2 className="animate-spin text-emerald-400 mb-4" size={48} />
              <p className="text-lg font-medium mb-2">Pesquisando "{itemName}"...</p>
              <p className="text-sm text-zinc-400">Analisando preços e viabilidade</p>
            </div>
          )}

          {/* Step 3: Payment Option */}
          {conversationStep === 'payment' && researchResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Back button */}
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
              >
                <ChevronLeft size={16} />
                Voltar e alterar o desejo
              </button>

              <div className="bg-white/10 rounded-xl p-6 border border-white/20">
                <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Sparkles className="text-emerald-400" size={20} />
                  Resultado da Pesquisa
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-zinc-400">Preço estimado:</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      R$ {researchResult.estimatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Faixa: R$ {researchResult.priceRange.min.toLocaleString('pt-BR')} - R$ {researchResult.priceRange.max.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {researchResult.description && (
                    <p className="text-sm text-zinc-300">{researchResult.description}</p>
                  )}
                  {researchResult.suggestions && researchResult.suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-zinc-400 mb-2">💡 Dicas:</p>
                      <ul className="space-y-1">
                        {researchResult.suggestions.map((tip: string, idx: number) => (
                          <li key={idx} className="text-xs text-zinc-300">• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4">
                    <label className="block text-sm text-zinc-400 mb-2">
                      O preço está incorreto? Corrija manualmente:
                    </label>
                    <input
                      type="number"
                      value={manualPrice || ''}
                      onChange={(e) => setManualPrice(parseFloat(e.target.value) || null)}
                      placeholder={researchResult.estimatedPrice.toFixed(2)}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-4">
                  Como você pretende pagar? 💳
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handlePaymentSelection('cash')}
                    className="p-6 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-emerald-400 rounded-xl transition-all group"
                  >
                    <DollarSign size={32} className="mx-auto mb-3 text-emerald-400" />
                    <p className="font-bold mb-1">À Vista</p>
                    <p className="text-xs text-zinc-400">Economizar e comprar</p>
                  </button>
                  <button
                    onClick={() => handlePaymentSelection('installments')}
                    className="p-6 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-emerald-400 rounded-xl transition-all group"
                  >
                    <Calendar size={32} className="mx-auto mb-3 text-emerald-400" />
                    <p className="font-bold mb-1">Parcelado</p>
                    <p className="text-xs text-zinc-400">Dividir em parcelas</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Installments */}
          {conversationStep === 'installments' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Back button */}
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
              >
                <ChevronLeft size={16} />
                Voltar para forma de pagamento
              </button>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-4">
                  Em quantas vezes? 📅
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[6, 10, 12, 18, 24].map(count => {
                    const amount = (manualPrice || researchResult?.estimatedPrice || 0) / count;
                    return (
                      <button
                        key={count}
                        onClick={() => handleInstallmentSelection(count)}
                        className="p-4 bg-white/10 hover:bg-emerald-500 border border-white/20 hover:border-emerald-400 rounded-xl transition-all"
                      >
                        <p className="font-bold text-lg">{count}x</p>
                        <p className="text-xs text-zinc-400">R$ {amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <label className="block text-xs text-zinc-400 mb-2">Ou escolha outro valor:</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 12)}
                      className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      min="2"
                      max="48"
                    />
                    <button
                      onClick={() => handleInstallmentSelection(installmentCount)}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Analysis Loading */}
          {conversationStep === 'analysis' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fadeIn">
              <Loader2 className="animate-spin text-emerald-400 mb-4" size={48} />
              <p className="text-lg font-medium mb-2">Analisando viabilidade...</p>
              <p className="text-sm text-zinc-400">Calculando impacto no seu orçamento</p>
            </div>
          )}

          {/* Step 6: Confirmation */}
          {conversationStep === 'confirmation' && viabilityResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Back button */}
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
              >
                <ChevronLeft size={16} />
                {paymentOption === 'installments' ? 'Voltar para número de parcelas' : 'Voltar para forma de pagamento'}
              </button>

              <div className={`rounded-xl p-6 border-2 ${
                viabilityResult.isViable
                  ? 'bg-emerald-900/30 border-emerald-400'
                  : 'bg-orange-900/30 border-orange-400'
              }`}>
                <div className="flex items-start gap-4 mb-4">
                  {viabilityResult.isViable ? (
                    <CheckCircle2 className="text-emerald-400 shrink-0" size={32} />
                  ) : (
                    <AlertCircle className="text-orange-400 shrink-0" size={32} />
                  )}
                  <div>
                    <h4 className="font-bold text-xl mb-2">
                      {viabilityResult.isViable ? '✅ Viável!' : '⏳ Requer Planejamento'}
                    </h4>
                    <p className="text-sm text-zinc-300 mb-4">{viabilityResult.analysis}</p>

                    {paymentOption === 'installments' && viabilityResult.installmentImpact && (
                      <div className="bg-white/10 rounded-lg p-3 mb-4">
                        <p className="text-xs text-zinc-400 mb-1">💳 Impacto da Parcela:</p>
                        <p className="text-sm text-white">{viabilityResult.installmentImpact}</p>
                        <p className="text-lg font-bold text-emerald-400 mt-2">
                          R$ {viabilityResult.installmentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
                        </p>
                      </div>
                    )}

                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-xs text-zinc-400 mb-1">💡 Recomendação:</p>
                      <p className="text-sm text-white">{viabilityResult.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmAddItem}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Adicionar à Lista
                </button>
                <button
                  onClick={handleCancel}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wishlist Items */}
      <div className="space-y-4">
        {filteredItems.length === 0 && !isAddingNew && (
          <div className="bg-white rounded-3xl p-12 text-center border border-zinc-100">
            <div className="w-20 h-20 bg-zinc-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Heart className="text-zinc-400" size={32} />
            </div>
            <h3 className="font-bold text-zinc-800 text-lg mb-2">Nenhum desejo adicionado</h3>
            <p className="text-zinc-500 text-sm mb-6">Comece adicionando seus objetivos e veja quando são viáveis!</p>
            <button
              onClick={startConversation}
              className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Adicionar Primeiro Desejo
            </button>
          </div>
        )}

        {filteredItems.map(item => {
          const progress = (item.savedAmount / item.targetAmount) * 100;
          const remaining = item.targetAmount - item.savedAmount;
          const isCompleted = remaining <= 0;
          const isAnalysisExpanded = expandedAnalyses[item.id];
          const isControlsExpanded = expandedControls[item.id];
          const statusBadge = getStatusBadge(item, progress);
          const typeIcon = getTypeIcon(item.type);
          const confidenceLabel = `Confianca de preco: ${getConfidenceLabel(item.priceResearchConfidence)}`;
          const suggestedMonthly = monthlySavingsPotential > 0 ? Math.min(remaining, monthlySavingsPotential) : 0;
          const etaMonths = monthlySavingsPotential > 0 ? Math.ceil(remaining / monthlySavingsPotential) : null;
          const payoffDate = item.installmentCount
            ? (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + item.installmentCount - 1);
                return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
              })()
            : null;
          const installmentImpact = item.installmentAmount && settings?.monthlyIncome
            ? (item.installmentAmount / settings.monthlyIncome) * 100
            : null;

          return (
            <div
              key={item.id}
              className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-zinc-100 shadow-sm hover:shadow-md transition-all"
              style={{
                animation: 'wishlist-fade-slide 0.25s ease',
                transition: 'transform 220ms ease, opacity 220ms ease'
              }}
            >
              {/* Mobile Layout */}
              <div className="md:hidden">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeIcon.color} font-bold shadow-sm shrink-0`}>
                    {typeIcon.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-zinc-800 truncate">{item.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.priority === WishlistPriority.HIGH ? 'bg-rose-100 text-rose-700' :
                        item.priority === WishlistPriority.MEDIUM ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir este desejo?')) {
                        onDeleteItem(item.id);
                      }
                    }}
                    className="p-1.5 active:bg-rose-50 rounded-lg text-zinc-400 active:text-rose-600 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                {item.paymentOption === 'installments' && item.installmentCount && (
                  <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg mb-3 inline-block">
                    {item.installmentCount}x de R$ {item.installmentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </div>
                )}
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-11 h-11 aspect-square rounded-full flex items-center justify-center ${typeIcon.color} font-bold shadow-sm`}>
                      {typeIcon.icon}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-zinc-800">{item.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          item.priority === WishlistPriority.HIGH ? 'bg-rose-100 text-rose-700' :
                          item.priority === WishlistPriority.MEDIUM ? 'bg-amber-100 text-amber-700' :
                          'bg-zinc-100 text-zinc-700'
                        }`}>
                          {item.priority}
                        </span>
                        {item.paymentOption === 'installments' && item.installmentCount && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            {item.installmentCount}x de R$ {item.installmentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {installmentImpact !== null && (
                              <span className="ml-2 text-[11px] text-blue-800/80 font-semibold">
                                ({installmentImpact.toFixed(1)}% da renda)
                              </span>
                            )}
                            {payoffDate && (
                              <span className="ml-2 text-[11px] text-blue-800/80 font-semibold">
                                quita em {payoffDate}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{confidenceLabel} • Fonte: IA</p>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-zinc-600 mb-3">{item.description}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {isCompleted && !item.isArchived && (
                    <button
                      onClick={() => convertToTransaction(item)}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Converter em compra"
                    >
                      Converter em compra
                    </button>
                  )}
                  {!item.isArchived ? (
                    <button
                      onClick={() => toggleArchive(item)}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                      title="Arquivar/Pausar"
                    >
                      Arquivar
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleArchive(item)}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Desarquivar"
                    >
                      Desarquivar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir este desejo?')) {
                        onDeleteItem(item.id);
                      }
                    }}
                    className="p-2 hover:bg-rose-50 rounded-lg text-zinc-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3 md:mb-4">
                <div className="flex justify-between items-end mb-1.5 md:mb-2">
                  <span className="text-lg md:text-2xl font-bold text-zinc-900">
                    R$ {item.savedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs md:text-sm text-zinc-500">
                    de R$ {item.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2 md:h-3 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  ></div>
                  {[25, 50, 75].map(mark => (
                    <div
                      key={mark}
                      className="absolute top-0 bottom-0 w-px bg-white/70"
                      style={{ left: `${mark}%` }}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-1.5 md:mt-2">
                  <span className="text-[10px] md:text-xs text-zinc-500">{progress.toFixed(0)}% alcançado</span>
                  <span className="text-[10px] md:text-xs font-bold text-zinc-700">
                    Faltam R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Quick progress + inline edits (collapsible) */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleControls(item.id)}
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Edit2 size={16} />
                    {isControlsExpanded ? 'Fechar ajustes' : 'Editar/ajustar objetivo'}
                  </button>
                  <span className="text-xs text-zinc-500">Ajustes rapidos</span>
                </div>

                <div
                  className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50 space-y-3 overflow-hidden"
                  style={{
                    maxHeight: isControlsExpanded ? 520 : 0,
                    opacity: isControlsExpanded ? 1 : 0,
                    transform: isControlsExpanded ? 'translateY(0)' : 'translateY(-6px)',
                    transition: 'all 240ms ease',
                    padding: isControlsExpanded ? '16px' : '0px 16px'
                  }}
                >
                  {isControlsExpanded && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          {[50, 100, 500].map(value => (
                            <button
                              key={value}
                              onClick={() => quickIncrement(item, value)}
                              className="px-3 py-2 text-sm font-bold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              +{value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <span>Valor poupado (R$):</span>
                          <input
                            type="number"
                            min={0}
                            max={item.targetAmount}
                            step="50"
                            value={item.savedAmount}
                            onChange={(e) => updateSavedAmount(item, parseFloat(e.target.value))}
                            className="w-28 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <span>Prioridade:</span>
                          <select
                            value={item.priority}
                            onChange={(e) => updatePriority(item, e.target.value as WishlistPriority)}
                            className="px-3 py-2 rounded-lg border border-zinc-200 text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          >
                            <option value={WishlistPriority.HIGH}>Alta</option>
                            <option value={WishlistPriority.MEDIUM}>Media</option>
                            <option value={WishlistPriority.LOW}>Baixa</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <span>Prazo (opcional):</span>
                          <input
                            type="date"
                            value={item.targetDate ? item.targetDate.substring(0, 10) : ''}
                            onChange={(e) => updateTargetDate(item, e.target.value)}
                            className="px-3 py-2 rounded-lg border border-zinc-200 text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Dica: use os botoes rapidos para registrar novas economias ou ajuste manualmente o valor poupado.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Analysis (click to expand) */}
              {item.aiAnalysis && (
                <div className="mb-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleAnalysis(item.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <div
                      className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                        item.isViable ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-orange-200 bg-orange-50 text-orange-600'
                      }`}
                      title={`${item.aiAnalysis}${item.aiRecommendation ? ' • ' + item.aiRecommendation : ''}`}
                    >
                      <Sparkles size={18} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-600">
                      {isAnalysisExpanded ? 'Esconder análise' : 'Ver análise IA'}
                    </span>
                  </button>

                  {isAnalysisExpanded && (
                    <div className={`rounded-xl p-4 ${
                      item.isViable ? 'bg-emerald-50 border border-emerald-100' : 'bg-orange-50 border border-orange-100'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          item.isViable ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          <Sparkles size={18} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm mb-1 text-zinc-800">Analise IA</h4>
                          <p className="text-sm text-zinc-700 mb-2">{item.aiAnalysis}</p>
                          {item.aiRecommendation && (
                            <p className="text-xs text-zinc-600 italic">Recomendação: {item.aiRecommendation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Info */}
              <div className="flex flex-wrap gap-4 text-sm">
                {item.targetDate && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Calendar size={16} />
                    <span>Meta: {new Date(item.targetDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {item.viabilityDate && !item.isViable && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <TrendingUp size={16} />
                    <span>Viável em: {new Date(item.viabilityDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {item.isViable ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : progress > 50 ? (
                    <AlertCircle size={16} className="text-orange-600" />
                  ) : (
                    <XCircle size={16} className="text-zinc-400" />
                  )}
                  <span className={item.isViable ? 'text-emerald-600 font-bold' : 'text-zinc-600'}>
                    {item.isViable ? 'Viável' : progress > 50 ? 'Em progresso' : 'Planejando'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WishlistTab;
