import React, { useState, useEffect } from 'react';
import { X, Check, ThumbsUp, ThumbsDown, Edit2, DollarSign } from 'lucide-react';
import { SavingsPlanAction } from '../services/savingsService';
import { RecommendationStatus, SavingsReview } from '../services/storageService';

interface ReviewRecommendationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: SavingsPlanAction | null;
  onSave: (review: SavingsReview) => void;
}

const ReviewRecommendationPanel: React.FC<ReviewRecommendationPanelProps> = ({
  isOpen,
  onClose,
  recommendation,
  onSave
}) => {
  const [status, setStatus] = useState<RecommendationStatus>('pending');
  const [justification, setJustification] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState<string>('');

  useEffect(() => {
    if (isOpen && recommendation) {
      setStatus(recommendation.status === 'pending' ? 'kept' : recommendation.status);
      setJustification(recommendation.justification || '');
      setAdjustedAmount(recommendation.impact.toString());
    }
  }, [isOpen, recommendation]);

  const handleSave = () => {
    if (!recommendation) return;
    
    const review: SavingsReview = {
      id: recommendation.id,
      status,
      justification: justification.trim() || undefined,
      adjustedAmount: status === 'adjusted' ? parseFloat(adjustedAmount) : undefined,
      reviewedAt: Date.now()
    };
    onSave(review);
    onClose();
  };

  // If not open, we still render the aside but translated off-screen to allow animation
  // However, if recommendation is null, we might want to render nothing or a placeholder.
  // The chat renders always but hides. Here we depend on `recommendation` data.
  // We can render the panel if `isOpen` is true OR if it's closing (to show exit animation).
  // For simplicity, let's render it always but control visibility with classes, 
  // and handle null recommendation gracefully (e.g. show empty state or return null if strictly not needed, 
  // but for animation we need it in DOM).
  
  // If recommendation is null, we can't show much. 
  // Let's assume the parent controls `isOpen` and `recommendation` is present when `isOpen` is true.
  
  return (
    <>
      {/* Side Panel */}
      <aside 
        className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.32,0.72,0,1) flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {recommendation ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 flex justify-between items-start bg-zinc-50/50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Revisar Recomendação</h3>
                <p className="text-sm text-zinc-500 mt-1">{recommendation.title}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Summary Card */}
              <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                <p className="text-sm text-zinc-700 mb-3 leading-relaxed">{recommendation.description}</p>
                <div className="flex justify-between items-center pt-3 border-t border-emerald-100/50">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Economia Estimada</span>
                  <span className="font-bold text-2xl text-emerald-700">R$ {recommendation.originalAmount?.toLocaleString('pt-BR') || recommendation.impact.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Decision Section */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-zinc-900 block">Qual sua decisão?</label>
                
                {/* Option: Keep */}
                <label className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${status === 'kept' ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/20' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}>
                  <div className={`mt-1 p-1 rounded-full border ${status === 'kept' ? 'border-white' : 'border-zinc-300'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${status === 'kept' ? 'bg-white' : 'bg-transparent'}`} />
                  </div>
                  <input 
                    type="radio" 
                    name="status" 
                    value="kept" 
                    checked={status === 'kept'} 
                    onChange={() => setStatus('kept')}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <ThumbsUp size={18} className={status === 'kept' ? 'text-emerald-400' : 'text-zinc-400'} />
                      Manter Despesa
                    </div>
                    <p className={`text-xs mt-1 ${status === 'kept' ? 'text-zinc-400' : 'text-zinc-500'}`}>É um gasto essencial ou consciente.</p>
                    
                    {status === 'kept' && (
                      <div className="mt-3 animate-fadeIn">
                        <input 
                          type="text" 
                          placeholder="Justificativa (opcional)" 
                          className="w-full p-3 text-sm border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 bg-zinc-800 text-white placeholder-zinc-500"
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Option: Dismiss */}
                <label className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${status === 'dismissed' ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/20' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}>
                  <div className={`mt-1 p-1 rounded-full border ${status === 'dismissed' ? 'border-white' : 'border-zinc-300'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${status === 'dismissed' ? 'bg-white' : 'bg-transparent'}`} />
                  </div>
                  <input 
                    type="radio" 
                    name="status" 
                    value="dismissed" 
                    checked={status === 'dismissed'} 
                    onChange={() => setStatus('dismissed')}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <ThumbsDown size={18} className={status === 'dismissed' ? 'text-rose-400' : 'text-zinc-400'} />
                      Dispensar Agora
                    </div>
                    <p className={`text-xs mt-1 ${status === 'dismissed' ? 'text-zinc-400' : 'text-zinc-500'}`}>Ignorar esta recomendação neste mês.</p>
                  </div>
                </label>

                {/* Option: Adjust */}
                <label className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${status === 'adjusted' ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/20' : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}>
                  <div className={`mt-1 p-1 rounded-full border ${status === 'adjusted' ? 'border-white' : 'border-zinc-300'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${status === 'adjusted' ? 'bg-white' : 'bg-transparent'}`} />
                  </div>
                  <input 
                    type="radio" 
                    name="status" 
                    value="adjusted" 
                    checked={status === 'adjusted'} 
                    onChange={() => setStatus('adjusted')}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <Edit2 size={18} className={status === 'adjusted' ? 'text-indigo-400' : 'text-zinc-400'} />
                      Ajustar Valor
                    </div>
                    <p className={`text-xs mt-1 ${status === 'adjusted' ? 'text-zinc-400' : 'text-zinc-500'}`}>Definir um valor de economia diferente.</p>

                    {status === 'adjusted' && (
                      <div className="mt-3 space-y-2 animate-fadeIn">
                        <div className="relative">
                          <DollarSign size={16} className="absolute left-3 top-3.5 text-zinc-500" />
                          <input 
                            type="number" 
                            placeholder="Valor da economia" 
                            className="w-full pl-9 p-3 text-sm border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 bg-zinc-800 text-white placeholder-zinc-500"
                            value={adjustedAmount}
                            onChange={(e) => setAdjustedAmount(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>

              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3 text-zinc-600 font-bold hover:bg-zinc-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Check size={20} />
                Confirmar
              </button>
            </div>
          </>
        ) : (
           <div className="flex items-center justify-center h-full text-zinc-400">
             <p>Selecione um item para revisar.</p>
           </div>
        )}
      </aside>
    </>
  );
};

export default ReviewRecommendationPanel;
