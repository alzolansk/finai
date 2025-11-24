import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, Insight, Category, TransactionType } from '../types';
import { generateInsights } from '../services/geminiService';
import { Lightbulb, AlertCircle, RefreshCw, CheckCircle2, BadgePercent, Trash2, Edit2, Plus, X, Wand2, Link2 } from 'lucide-react';
import { getIconForTransaction } from '../utils/iconMapper';

interface InsightsPanelProps {
  transactions: Transaction[];
  onUpdate: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onAdd: (transaction: Transaction) => void;
}

interface StoredInsights {
  insights: Insight[];
  hash: string;
  timestamp: number;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ transactions, onUpdate, onDelete, onAdd }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<Partial<Transaction>>({});
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Hash based on transaction IDs to detect actual additions/removals
  const currentHash = useMemo(() => {
      // Sort transaction IDs to create a consistent hash
      // This will change only when transactions are added or removed
      const ids = transactions.map(t => t.id).sort().join(',');
      // Create a simple hash from the IDs string
      let hash = 0;
      for (let i = 0; i < ids.length; i++) {
        const char = ids.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `${transactions.length}-${hash}`;
  }, [transactions]);

  // Load insights from localStorage
  const loadStoredInsights = (): StoredInsights | null => {
    try {
      const stored = localStorage.getItem('finai_insights');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading stored insights:', e);
    }
    return null;
  };

  // Save insights to localStorage
  const saveInsights = (insights: Insight[], hash: string) => {
    try {
      const data: StoredInsights = {
        insights,
        hash,
        timestamp: Date.now()
      };
      localStorage.setItem('finai_insights', JSON.stringify(data));
    } catch (e) {
      console.error('Error saving insights:', e);
    }
  };

  const fetchInsights = async (force = false) => {
    // If not forced and we already have insights for this hash, skip
    if (!force) {
      const stored = loadStoredInsights();
      if (stored && stored.hash === currentHash && insights.length > 0) {
        return; // Skip if data hasn't changed and we have insights
      }
    }

    setLoading(true);
    try {
      const result = await generateInsights(transactions);
      setInsights(result);
      saveInsights(result, currentHash);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Load insights on mount
  useEffect(() => {
    if (transactions.length < 5) {
      setInsights([]);
      return;
    }

    const stored = loadStoredInsights();

    // If we have stored insights with the same hash, use them
    if (stored && stored.hash === currentHash) {
      setInsights(stored.insights);
    } else {
      // Otherwise, generate new insights
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHash]); // Only re-run when hash changes (additions/removals)

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setFormData(t);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingTransaction(null);
    setFormData({
      description: '',
      amount: 0,
      category: Category.SUBSCRIPTIONS,
      type: TransactionType.EXPENSE,
      isRecurring: true,
      date: new Date().toISOString(),
      isAiGenerated: false
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.description || !formData.amount) return;
    
    const transactionToSave = {
        ...formData,
        amount: Number(formData.amount),
        id: editingTransaction ? editingTransaction.id : crypto.randomUUID(),
        date: formData.date || new Date().toISOString(),
        isRecurring: true, // Ensure it stays recurring
        createdAt: editingTransaction ? editingTransaction.createdAt : Date.now()
    } as Transaction;

    if (editingTransaction) {
        onUpdate(transactionToSave);
    } else {
        onAdd(transactionToSave);
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmationId === id) {
        onDelete(id);
        setDeleteConfirmationId(null);
    } else {
        setDeleteConfirmationId(id);
        setTimeout(() => setDeleteConfirmationId(null), 3000);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-light text-zinc-800">Insights</h2>
          <p className="text-zinc-500 text-sm mt-1">Análise inteligente dos seus hábitos.</p>
        </div>
        <button 
          onClick={() => fetchInsights(true)} 
          disabled={loading}
          className="bg-zinc-900 text-white p-3 rounded-full hover:bg-zinc-800 transition-colors shadow-lg"
          title="Recalcular Insights"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && insights.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-zinc-100 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
          <h3 className="text-zinc-800 font-bold mb-2">Gerando insights...</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">Analisando seus hábitos financeiros e identificando oportunidades de economia.</p>
        </div>
      ) : transactions.length < 5 ? (
        <div className="bg-white rounded-3xl p-10 border border-zinc-100 text-center">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <Lightbulb className="text-zinc-400" />
          </div>
          <h3 className="text-zinc-800 font-bold mb-2">Ainda aprendendo...</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">Preciso de mais alguns dados para gerar relatórios precisos. Continue registrando seus gastos!</p>
        </div>
      ) : (
        // Horizontal Scroll Container
        <div className="flex overflow-x-auto gap-6 pb-6 snap-x scrollbar-hide">
            {insights.map(insight => (
                <div 
                key={insight.id} 
                className={`min-w-[300px] md:min-w-[350px] p-6 rounded-3xl border bg-white hover:shadow-md transition-all flex flex-col justify-between snap-center ${
                    insight.type === 'warning' ? 'border-l-4 border-l-rose-500' : 
                    insight.type === 'success' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-blue-500'
                }`}
                >
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        {insight.type === 'warning' ? <AlertCircle className="text-rose-500" /> : 
                        insight.type === 'success' ? <CheckCircle2 className="text-emerald-500" /> : <Lightbulb className="text-blue-500" />}
                        <h3 className="font-bold text-zinc-800">{insight.title}</h3>
                    </div>
                    <p className="text-zinc-600 text-sm leading-relaxed mb-6">{insight.description}</p>
                </div>
                
                {insight.savingsPotential && insight.savingsPotential > 0 && (
                    <div className="bg-emerald-50 p-3 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-bold mt-auto">
                        <BadgePercent size={18} />
                        Economia: R$ {insight.savingsPotential.toLocaleString('pt-BR')}
                    </div>
                )}

                {insight.relatedTransactionId && (
                    <button 
                        onClick={() => {
                            const t = transactions.find(tr => tr.id === insight.relatedTransactionId);
                            if (t) {
                                setEditingTransaction(t);
                                setFormData({
                                    ...t,
                                    amount: insight.suggestedAmount || t.amount
                                });
                                setIsModalOpen(true);
                            }
                        }}
                        className="mt-3 w-full py-2.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-900 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <Edit2 size={14} />
                        {insight.suggestedAmount ? `Ajustar para R$ ${insight.suggestedAmount}` : 'Editar Gasto'}
                    </button>
                )}
                </div>
            ))}
             {insights.length === 0 && !loading && (
                <div className="p-10 w-full text-center text-zinc-400">
                    Nenhum insight gerado no momento.
                </div>
             )}
        </div>
      )}

      {/* Subscription List */}
      <div>
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-zinc-800">Assinaturas Detectadas</h3>
            <button 
                onClick={handleAddClick}
                className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
            >
                <Plus size={16} /> Adicionar
            </button>
         </div>
         
         <div className="space-y-3">
            {transactions.filter(t => t.isRecurring).map(t => {
                const iconConfig = getIconForTransaction(t.description, t.category);
                const IconComponent = iconConfig.icon;
                
                return (
                <div key={t.id} className={`flex items-center justify-between bg-white p-4 rounded-2xl border transition-all group ${t.isAiGenerated ? 'border-emerald-200' : 'border-zinc-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.isAiGenerated ? 'bg-emerald-100' : iconConfig.bgColor}`}>
                            {t.isAiGenerated ? (
                                <Wand2 size={16} className="text-emerald-600" />
                            ) : (
                                <IconComponent size={18} className={iconConfig.iconColor} />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-zinc-800">{t.description}</p>
                                {t.isAiGenerated && (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">IA</span>
                                )}
                                {t.linkedToInvoice && t.creditCardIssuer && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full" title={`Vinculado à fatura ${t.creditCardIssuer}`}>
                                        <Link2 size={9} /> {t.creditCardIssuer}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400">Recorrente • {new Date(t.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-zinc-900">R$ {t.amount.toLocaleString('pt-BR')}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(t)} className="p-2 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors">
                                <Edit2 size={16} />
                            </button>
                            <button 
                                onClick={() => handleDeleteClick(t.id)} 
                                className={`p-2 rounded-lg transition-all flex items-center gap-2 ${deleteConfirmationId === t.id ? 'bg-rose-100 text-rose-600 px-3' : 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50'}`}
                            >
                                {deleteConfirmationId === t.id ? <span className="text-xs font-bold">Confirmar?</span> : <Trash2 size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })}
            {transactions.filter(t => t.isRecurring).length === 0 && (
                <div className="text-center py-10 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                    <p className="text-zinc-400 text-sm italic">Nenhuma assinatura detectada.</p>
                    <button onClick={handleAddClick} className="mt-2 text-emerald-600 font-bold text-sm hover:underline">Adicionar manualmente</button>
                </div>
            )}
         </div>
      </div>

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-scaleIn">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-zinc-800">{editingTransaction ? 'Editar Assinatura' : 'Nova Assinatura'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Nome</label>
                        <input 
                            type="text" 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            className="w-full p-3 bg-zinc-50 rounded-xl border-none focus:ring-2 focus:ring-zinc-200 outline-none font-medium text-zinc-800"
                            placeholder="Ex: Netflix"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Valor</label>
                        <input 
                            type="number" 
                            value={formData.amount} 
                            onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                            className="w-full p-3 bg-zinc-50 rounded-xl border-none focus:ring-2 focus:ring-zinc-200 outline-none font-bold text-zinc-800"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Credit Card Association */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="linkedToInvoiceModal"
                                checked={formData.linkedToInvoice || false}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setFormData({
                                        ...formData, 
                                        linkedToInvoice: checked,
                                        creditCardIssuer: checked ? formData.creditCardIssuer : undefined
                                    });
                                }}
                                className="w-4 h-4 rounded border-2 border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-200 cursor-pointer"
                            />
                            <label htmlFor="linkedToInvoiceModal" className="text-sm text-zinc-700 cursor-pointer select-none font-medium">
                                Vincular a um cartão de crédito
                            </label>
                        </div>

                        {formData.linkedToInvoice && (
                            <div className="animate-fadeIn">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Cartão</label>
                                <input
                                    type="text"
                                    value={formData.creditCardIssuer || ''}
                                    onChange={(e) => setFormData({...formData, creditCardIssuer: e.target.value})}
                                    className="w-full p-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-300 outline-none transition-all text-zinc-800"
                                    placeholder="Ex: Nubank, Itaú, C6 Bank"
                                />
                                <p className="text-xs text-zinc-500 mt-2">
                                    Esta assinatura será incluída nas faturas deste cartão
                                </p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all mt-4"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InsightsPanel;