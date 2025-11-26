import React, { useState, useMemo } from 'react';
import { Transaction, UserSettings, WishlistItem, WishlistItemType, WishlistPriority } from '../types';
import { Heart, Plus, Trash2, TrendingUp, Calendar, DollarSign, Sparkles, CheckCircle2, XCircle, AlertCircle, Edit2, Save, X, Loader2, HelpCircle, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { researchWishlistItem, analyzeWishlistViability } from '../services/geminiService';

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

  // Calculate monthly expenses considering past AND future recurring transactions
  const { monthlyIncome, monthlyExpenses, monthlySavingsPotential } = useMemo(() => {
    const income = settings?.monthlyIncome || 0;

    // Calculate average monthly expenses from recent months
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Get last 3 months of data (PAST)
    const pastMonths = [0, 1, 2].map(offset => {
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

    // Get next 3 months of data (FUTURE) - considering scheduled transactions
    const futureMonths = [1, 2, 3].map(offset => {
      const date = new Date(currentYear, currentMonth + offset, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth()
      };
    });

    const futureMonthlyExpenseTotals = futureMonths.map(({ year, month }) => {
      return transactions
        .filter(t => {
          if (t.type !== 'EXPENSE') return false;
          const tDate = new Date(t.paymentDate || t.date);
          return tDate.getFullYear() === year && tDate.getMonth() === month;
        })
        .reduce((sum, t) => sum + t.amount, 0);
    });

    // Average of last 3 months (past)
    const avgPastExpense = pastMonthlyExpenseTotals.length > 0
      ? pastMonthlyExpenseTotals.reduce((a, b) => a + b, 0) / pastMonthlyExpenseTotals.length
      : 0;

    // Average of next 3 months (future scheduled)
    const avgFutureExpense = futureMonthlyExpenseTotals.length > 0
      ? futureMonthlyExpenseTotals.reduce((a, b) => a + b, 0) / futureMonthlyExpenseTotals.length
      : 0;

    // Add recurring expenses that might not be captured
    const recurringExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && t.isRecurring)
      .reduce((sum, t) => sum + t.amount, 0);

    // Use the maximum of: past average, future average, or recurring total
    // This is conservative and accounts for upcoming commitments
    const expenses = Math.max(avgPastExpense, avgFutureExpense, recurringExpenses);
    const savingsPotential = income - expenses;

    return {
      monthlyIncome: income,
      monthlyExpenses: expenses,
      monthlySavingsPotential: savingsPotential
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

  const sortedItems = [...wishlistItems].sort((a, b) => {
    const priorityOrder = { [WishlistPriority.HIGH]: 3, [WishlistPriority.MEDIUM]: 2, [WishlistPriority.LOW]: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

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

  return (
    <div className="space-y-8 pb-20 animate-fadeIn">
      <style>{motionStyles}</style>
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-light text-zinc-800 flex items-center gap-3">
            Lista de Desejos Inteligente
            <div className="group relative">
              <HelpCircle size={20} className="text-zinc-400 cursor-help" />
              <div className="absolute left-0 top-full mt-2 w-80 p-4 bg-white rounded-xl shadow-xl border border-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <h4 className="font-bold text-sm mb-2 text-zinc-800">Como funciona?</h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Nossa IA pesquisa preços automaticamente, analisa sua situação financeira e indica quando seus objetivos serão viáveis.
                  Você pode escolher pagar à vista ou parcelado e receber recomendações personalizadas.
                </p>
              </div>
            </div>
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Planeje seus objetivos e veja quando são viáveis com IA</p>
        </div>
        <button
          onClick={isAddingNew ? handleCancel : startConversation}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${
            isAddingNew
              ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
          }`}
        >
          {isAddingNew ? <X size={20} /> : <Plus size={20} />}
          {isAddingNew ? 'Cancelar' : 'Novo Desejo'}
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm group relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign size={20} />
            </div>
            <h3 className="font-bold text-zinc-700 text-sm flex items-center gap-2">
              Potencial Mensal
              <Info size={14} className="text-zinc-400 cursor-help" />
            </h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            R$ {monthlySavingsPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Disponível para objetivos</p>

          {/* Tooltip */}
          <div className="absolute left-0 top-full mt-2 w-80 p-3 bg-zinc-900 text-white rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs">
            <p className="mb-2"><strong>Como calculamos:</strong></p>
            <p className="mb-1">📊 Renda mensal: R$ {monthlyIncome.toLocaleString('pt-BR')}</p>
            <p className="mb-1">📉 Despesas (consideradas): R$ {monthlyExpenses.toLocaleString('pt-BR')}</p>
            <div className="my-2 h-px bg-zinc-700"></div>
            <p className="text-emerald-400 font-bold text-sm">💰 Sobra: R$ {monthlySavingsPotential.toLocaleString('pt-BR')}</p>
            <div className="mt-3 p-2 bg-zinc-800 rounded-lg">
              <p className="text-zinc-400 text-[10px] leading-relaxed">
                <strong>Análise completa:</strong> Consideramos a média dos últimos 3 meses,
                os próximos 3 meses de despesas já programadas, e todas as despesas recorrentes.
                Usamos o valor mais alto para ser conservador.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Heart size={20} />
            </div>
            <h3 className="font-bold text-zinc-700 text-sm">Total de Desejos</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{wishlistItems.length}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {wishlistItems.filter(i => i.isViable).length} viáveis agora
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
            R$ {wishlistItems.reduce((sum, item) => sum + item.targetAmount, 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Soma de todos os objetivos</p>
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
        {sortedItems.length === 0 && !isAddingNew && (
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

        {sortedItems.map(item => {
          const progress = (item.savedAmount / item.targetAmount) * 100;
          const remaining = item.targetAmount - item.savedAmount;
          const isAnalysisExpanded = expandedAnalyses[item.id];
          const isControlsExpanded = expandedControls[item.id];

          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm hover:shadow-md transition-all"
              style={{
                animation: 'wishlist-fade-slide 0.25s ease',
                transition: 'transform 220ms ease, opacity 220ms ease'
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-zinc-800">{item.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.priority === WishlistPriority.HIGH ? 'bg-rose-100 text-rose-700' :
                      item.priority === WishlistPriority.MEDIUM ? 'bg-amber-100 text-amber-700' :
                      'bg-zinc-100 text-zinc-700'
                    }`}>
                      {item.priority}
                    </span>
                    {item.paymentOption === 'installments' && item.installmentCount && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                        {item.installmentCount}x de R$ {item.installmentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-zinc-600 mb-3">{item.description}</p>
                  )}
                </div>

                <div className="flex gap-2">
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
              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-2xl font-bold text-zinc-900">
                    R$ {item.savedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-zinc-500">
                    de R$ {item.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-zinc-500">{progress.toFixed(1)}% alcançado</span>
                  <span className="text-xs font-bold text-zinc-700">
                    Faltam R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  <span className="text-xs text-zinc-500">Ajustes rapidos sem poluir a tela</span>
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
