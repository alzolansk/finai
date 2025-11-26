import React, { useState, useMemo } from 'react';
import { Transaction, BudgetLimit, Category, UserSettings } from '../types';
import {
  getBudgetLimits,
  saveBudgetLimit,
  deleteBudgetLimit,
  toggleBudgetLimit,
  calculateBudgetStatus,
  generateBudgetAdjustments,
  BudgetStatus
} from '../services/budgetService';
import { Target, Plus, X, TrendingDown, AlertCircle, Sparkles, ChevronRight, Edit2, Trash2, CreditCard, DollarSign } from 'lucide-react';

interface BudgetsPageProps {
  transactions: Transaction[];
  settings: UserSettings;
}

const BudgetsPage: React.FC<BudgetsPageProps> = ({ transactions, settings }) => {
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(getBudgetLimits());
  const [isAddingLimit, setIsAddingLimit] = useState(false);
  const [editingLimit, setEditingLimit] = useState<BudgetLimit | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form State
  const [formType, setFormType] = useState<'category' | 'global' | 'card'>('category');
  const [formCategory, setFormCategory] = useState<Category>(Category.FOOD);
  const [formCardIssuer, setFormCardIssuer] = useState('');
  const [formLimit, setFormLimit] = useState('');

  const budgetStatuses = useMemo(
    () => calculateBudgetStatus(transactions),
    [transactions, budgetLimits]
  );

  const suggestions = useMemo(
    () => generateBudgetAdjustments(transactions, settings.monthlyIncome, settings.savingsGoal),
    [transactions, settings]
  );

  const handleAddLimit = () => {
    if (!formLimit || parseFloat(formLimit) <= 0) return;

    const newLimit: BudgetLimit = {
      id: crypto.randomUUID(),
      type: formType,
      category: formType === 'category' ? formCategory : undefined,
      cardIssuer: formType === 'card' ? formCardIssuer : undefined,
      monthlyLimit: parseFloat(formLimit),
      createdAt: Date.now(),
      isActive: true
    };

    const updated = saveBudgetLimit(newLimit);
    setBudgetLimits(updated);
    resetForm();
  };

  const handleUpdateLimit = () => {
    if (!editingLimit || !formLimit || parseFloat(formLimit) <= 0) return;

    const updated = saveBudgetLimit({
      ...editingLimit,
      monthlyLimit: parseFloat(formLimit),
      updatedAt: Date.now()
    });

    setBudgetLimits(updated);
    setEditingLimit(null);
    resetForm();
  };

  const handleDeleteLimit = (id: string) => {
    if (confirm('Deseja realmente excluir este limite?')) {
      const updated = deleteBudgetLimit(id);
      setBudgetLimits(updated);
    }
  };

  const handleToggleLimit = (id: string) => {
    const updated = toggleBudgetLimit(id);
    setBudgetLimits(updated);
  };

  const handleApplySuggestion = (suggestion: any) => {
    const existingLimit = budgetLimits.find(l => l.category === suggestion.category && l.type === 'category');

    if (existingLimit) {
      const updated = saveBudgetLimit({
        ...existingLimit,
        monthlyLimit: suggestion.suggestedLimit,
        updatedAt: Date.now()
      });
      setBudgetLimits(updated);
    } else {
      const newLimit: BudgetLimit = {
        id: crypto.randomUUID(),
        type: 'category',
        category: suggestion.category,
        monthlyLimit: suggestion.suggestedLimit,
        createdAt: Date.now(),
        isActive: true
      };
      const updated = saveBudgetLimit(newLimit);
      setBudgetLimits(updated);
    }
  };

  const resetForm = () => {
    setFormType('category');
    setFormCategory(Category.FOOD);
    setFormCardIssuer('');
    setFormLimit('');
    setIsAddingLimit(false);
    setEditingLimit(null);
  };

  const startEdit = (limit: BudgetLimit) => {
    setEditingLimit(limit);
    setFormLimit(limit.monthlyLimit.toString());
    setIsAddingLimit(true);
  };

  const getStatusColor = (status: BudgetStatus) => {
    if (status.isOverBudget) return 'border-rose-200 bg-rose-50';
    if (status.percentageUsed >= 80) return 'border-orange-200 bg-orange-50';
    return 'border-emerald-200 bg-emerald-50';
  };

  const getProgressColor = (status: BudgetStatus) => {
    if (status.isOverBudget) return 'bg-rose-500';
    if (status.percentageUsed >= 80) return 'bg-orange-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-light text-zinc-900 tracking-tight">Orçamentos e Limites</h2>
          <p className="text-zinc-500 mt-1">Defina e gerencie seus limites de gastos</p>
        </div>
        <button
          onClick={() => setIsAddingLimit(true)}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          Novo Limite
        </button>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Sparkles size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">Ajustes Sugeridos pela IA</h3>
                <p className="text-sm text-zinc-600">Baseado nos últimos 3 meses</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              {showSuggestions ? 'Ocultar' : 'Ver Todas'}
            </button>
          </div>

          {showSuggestions && (
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-zinc-900">{suggestion.category}</span>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                          Economize R$ {suggestion.reduction.toFixed(0)}/mês
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 mb-2">{suggestion.rationale}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>Atual: R$ {suggestion.currentLimit.toFixed(0)}</span>
                        <ChevronRight size={14} />
                        <span className="text-emerald-600 font-bold">Sugerido: R$ {suggestion.suggestedLimit.toFixed(0)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Budget Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgetStatuses.map(status => (
          <div key={status.limitId} className={`border-2 rounded-3xl p-6 transition-all ${getStatusColor(status)}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  {status.type === 'card' ? <CreditCard size={20} className="text-zinc-700" /> :
                   status.type === 'global' ? <DollarSign size={20} className="text-zinc-700" /> :
                   <Target size={20} className="text-zinc-700" />}
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">
                    {status.type === 'category' && status.category}
                    {status.type === 'card' && status.cardIssuer}
                    {status.type === 'global' && 'Orçamento Global'}
                  </h3>
                  <p className="text-xs text-zinc-600">
                    {status.type === 'category' && 'Limite por Categoria'}
                    {status.type === 'card' && 'Limite do Cartão'}
                    {status.type === 'global' && 'Limite Total'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-zinc-900">R$ {status.spent.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                <span className="text-zinc-500 text-sm">de R$ {status.limit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
              </div>

              <div className="w-full bg-white rounded-full h-3 overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${getProgressColor(status)}`}
                  style={{ width: `${Math.min(100, status.percentageUsed)}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">{Math.round(status.percentageUsed)}% consumido</span>
                <span className={status.remaining >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {status.remaining >= 0 ? `R$ ${status.remaining.toFixed(0)} disponível` : `R$ ${Math.abs(status.remaining).toFixed(0)} acima`}
                </span>
              </div>
            </div>

            {status.willExceed && (
              <div className="bg-white border border-orange-200 rounded-xl p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-orange-900 mb-1">Projeção de Estouro</p>
                    <p className="text-orange-700">
                      Projeção: R$ {status.projectedSpend.toFixed(0)} ({Math.round(status.projectedPercentage)}%)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const limit = budgetLimits.find(l => l.id === status.limitId);
                  if (limit) startEdit(limit);
                }}
                className="flex-1 py-2 text-xs font-bold bg-white border border-zinc-300 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 size={14} />
                Editar
              </button>
              <button
                onClick={() => handleDeleteLimit(status.limitId)}
                className="flex-1 py-2 text-xs font-bold bg-white border border-rose-300 text-rose-600 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>
        ))}

        {budgetStatuses.length === 0 && (
          <div className="col-span-full bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl p-12 text-center">
            <Target size={48} className="text-zinc-300 mx-auto mb-4" />
            <h3 className="font-bold text-zinc-900 mb-2">Nenhum Limite Configurado</h3>
            <p className="text-zinc-500 mb-4">Comece criando seu primeiro limite de gastos</p>
            <button
              onClick={() => setIsAddingLimit(true)}
              className="px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Criar Limite
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddingLimit && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900">
                {editingLimit ? 'Editar Limite' : 'Novo Limite'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!editingLimit && (
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">Tipo de Limite</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setFormType('category')}
                      className={`py-3 rounded-xl text-sm font-bold transition-all ${
                        formType === 'category'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Categoria
                    </button>
                    <button
                      onClick={() => setFormType('global')}
                      className={`py-3 rounded-xl text-sm font-bold transition-all ${
                        formType === 'global'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Global
                    </button>
                    <button
                      onClick={() => setFormType('card')}
                      className={`py-3 rounded-xl text-sm font-bold transition-all ${
                        formType === 'card'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      Cartão
                    </button>
                  </div>
                </div>
              )}

              {formType === 'category' && !editingLimit && (
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as Category)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 outline-none"
                  >
                    {Object.values(Category).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {formType === 'card' && !editingLimit && (
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">Emissor do Cartão</label>
                  <input
                    type="text"
                    placeholder="Ex: Nubank, C6, Itaú"
                    value={formCardIssuer}
                    onChange={(e) => setFormCardIssuer(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Limite Mensal (R$)</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={formLimit}
                  onChange={(e) => setFormLimit(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-300 outline-none text-lg font-bold"
                  step="0.01"
                  min="0"
                />
              </div>

              <button
                onClick={editingLimit ? handleUpdateLimit : handleAddLimit}
                disabled={!formLimit || (formType === 'card' && !formCardIssuer)}
                className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingLimit ? 'Atualizar Limite' : 'Criar Limite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;
