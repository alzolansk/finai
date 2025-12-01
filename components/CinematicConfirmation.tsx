import React, { useState, useEffect } from 'react';
import { FileCheck, CreditCard, Calendar, Layers, Check, X, Sparkles, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

interface Transaction {
  description: string;
  amount: number;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
}

interface CinematicConfirmationProps {
  fileName: string;
  transactionCount: number;
  issuer?: string;
  dueDate?: string;
  documentType?: 'invoice' | 'bank_statement';
  transactions: Transaction[];
  onConfirm: () => void;
  onCancel: () => void;
}

const CinematicConfirmation: React.FC<CinematicConfirmationProps> = ({
  fileName,
  transactionCount,
  issuer,
  dueDate,
  documentType,
  transactions,
  onConfirm,
  onCancel
}) => {
  const [showStats, setShowStats] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [expandedView, setExpandedView] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setTimeout(() => setShowStats(true), 200);
    setTimeout(() => setShowTransactions(true), 500);
  }, []);

  const totalAmount = transactions.reduce((sum, t) => sum + (t.type === 'EXPENSE' ? t.amount : 0), 0);
  const totalIncome = transactions.reduce((sum, t) => sum + (t.type === 'INCOME' ? t.amount : 0), 0);

  const displayTransactions = expandedView ? transactions : transactions.slice(0, 3);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fadeIn">
      {/* Main container - Dark theme */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl overflow-hidden">
        
        {/* Animated background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Header */}
        <div className="relative z-10 flex items-start gap-4 mb-6">
          <div className="relative">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"
                 style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
              <FileCheck className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            <div className="absolute inset-0 bg-emerald-500 rounded-2xl animate-ping opacity-20" />
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-xl md:text-2xl mb-1 flex items-center gap-2">
              Processamento Concluído
              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                ✓ Pronto
              </span>
            </h3>
            <p className="text-zinc-400 text-sm font-mono truncate">{fileName}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={`
          relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 transition-all duration-700
          ${showStats ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        `}>
          <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50 hover:border-emerald-500/50 transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Transações</p>
            </div>
            <p className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">{transactionCount}</p>
          </div>

          {issuer && (
            <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50 hover:border-blue-500/50 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Emissor</p>
              </div>
              <p className="text-lg font-bold text-white truncate group-hover:text-blue-400 transition-colors">{issuer}</p>
            </div>
          )}

          {dueDate && documentType === 'invoice' && (
            <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50 hover:border-purple-500/50 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Vencimento</p>
              </div>
              <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                {new Date(dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          )}

          <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50 hover:border-amber-500/50 transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Tipo</p>
            </div>
            <p className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
              {documentType === 'bank_statement' ? 'Extrato' : 'Fatura'}
            </p>
          </div>
        </div>

        {/* Summary bar */}
        {totalAmount > 0 && (
          <div className="relative z-10 bg-zinc-800/40 backdrop-blur-sm rounded-xl p-4 mb-6 border border-zinc-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Total de Despesas</p>
                  <p className="text-xl font-bold text-white">R$ {totalAmount.toFixed(2)}</p>
                </div>
              </div>
              {totalIncome > 0 && (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-zinc-400 text-right">Receitas</p>
                    <p className="text-lg font-bold text-emerald-400">+R$ {totalIncome.toFixed(2)}</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transactions Preview */}
        <div className={`
          relative z-10 transition-all duration-700
          ${showTransactions ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Preview das Transações
            </h4>
            {transactions.length > 3 && (
              <button
                onClick={() => setExpandedView(!expandedView)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
              >
                {expandedView ? (
                  <>Ver menos <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Ver todas ({transactions.length}) <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {displayTransactions.map((t, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all duration-300
                  ${hoveredIndex === idx 
                    ? 'bg-zinc-700/60 border-zinc-600 scale-[1.02]' 
                    : 'bg-zinc-800/40 border-zinc-700/50'
                  }
                  border backdrop-blur-sm
                `}
                style={{ 
                  animationDelay: `${idx * 0.1}s`,
                  animation: showTransactions ? 'fadeIn 0.5s ease-out forwards' : 'none'
                }}
              >
                {/* Icon */}
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all
                  ${t.type === 'INCOME' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/20 text-red-400'
                  }
                  ${hoveredIndex === idx ? 'scale-110' : ''}
                `}>
                  {t.type === 'INCOME' ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-400">{t.category}</span>
                    {t.date && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right">
                  <span className={`
                    text-base font-bold
                    ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-white'}
                  `}>
                    {t.type === 'INCOME' ? '+' : ''} R$ {t.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-2xl font-bold transition-all border border-zinc-700 hover:border-zinc-600 flex items-center justify-center gap-2"
          >
            <X size={20} />
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check size={20} />
            Confirmar Importação
          </button>
        </div>
      </div>
    </div>
  );
};

export default CinematicConfirmation;
