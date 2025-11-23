import React, { useEffect, useState, useMemo } from 'react';
import { Transaction, Insight } from '../types';
import { generateInsights } from '../services/geminiService';
import { Lightbulb, AlertCircle, RefreshCw, CheckCircle2, BadgePercent } from 'lucide-react';

interface InsightsPanelProps {
  transactions: Transaction[];
}

interface StoredInsights {
  insights: Insight[];
  hash: string;
  timestamp: number;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ transactions }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

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
                className={`min-w-[300px] md:min-w-[350px] p-6 rounded-3xl border shadow-sm bg-white hover:shadow-md transition-all flex flex-col justify-between snap-center ${
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
         <h3 className="text-lg font-bold text-zinc-800 mb-6">Assinaturas Detectadas</h3>
         <div className="space-y-3">
            {transactions.filter(t => t.isRecurring).map(t => (
                <div key={t.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold text-xs">
                            {t.description.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-zinc-800">{t.description}</p>
                            <p className="text-xs text-zinc-400">Recorrente</p>
                        </div>
                    </div>
                    <span className="font-bold text-zinc-900">R$ {t.amount.toLocaleString('pt-BR')}</span>
                </div>
            ))}
            {transactions.filter(t => t.isRecurring).length === 0 && (
                <p className="text-zinc-400 text-sm italic">Nenhuma assinatura detectada.</p>
            )}
         </div>
      </div>
    </div>
  );
};

export default InsightsPanel;