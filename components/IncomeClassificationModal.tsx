import React, { useState } from 'react';
import { IncomeClassification } from '../types';
import { DollarSign, Calendar, TrendingUp, X } from 'lucide-react';

interface IncomeClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (classification: IncomeClassification) => void;
  transactionDescription: string;
}

const IncomeClassificationModal: React.FC<IncomeClassificationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  transactionDescription
}) => {
  const [type, setType] = useState<'fixed' | 'variable'>('fixed');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');

  const handleSave = () => {
    const classification: IncomeClassification = {
      type,
      description: transactionDescription,
      expectedAmount: type === 'fixed' && expectedAmount ? parseFloat(expectedAmount) : undefined,
      frequency: type === 'fixed' ? frequency : undefined
    };

    onSave(classification);
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-zinc-900">Classificar Receita</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong className="font-bold">"{transactionDescription}"</strong> é uma receita fixa ou variável?
            </p>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-3">Tipo de Receita</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType('fixed')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  type === 'fixed'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    type === 'fixed' ? 'bg-emerald-100' : 'bg-zinc-100'
                  }`}>
                    <Calendar size={24} className={type === 'fixed' ? 'text-emerald-600' : 'text-zinc-400'} />
                  </div>
                  <span className={`font-bold text-sm ${type === 'fixed' ? 'text-emerald-900' : 'text-zinc-600'}`}>
                    Fixa
                  </span>
                  <span className="text-xs text-zinc-500 text-center">Recorrente e previsível</span>
                </div>
              </button>

              <button
                onClick={() => setType('variable')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  type === 'variable'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    type === 'variable' ? 'bg-blue-100' : 'bg-zinc-100'
                  }`}>
                    <TrendingUp size={24} className={type === 'variable' ? 'text-blue-600' : 'text-zinc-400'} />
                  </div>
                  <span className={`font-bold text-sm ${type === 'variable' ? 'text-blue-900' : 'text-zinc-600'}`}>
                    Variável
                  </span>
                  <span className="text-xs text-zinc-500 text-center">Esporádica ou irregular</span>
                </div>
              </button>
            </div>
          </div>

          {/* Fixed Income Details */}
          {type === 'fixed' && (
            <div className="space-y-4 animate-slideUp">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Valor Esperado (R$)</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="number"
                    placeholder="0,00"
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none text-lg font-bold"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Frequência</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none font-medium"
                >
                  <option value="monthly">Mensal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSkip}
              className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
            >
              Pular
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeClassificationModal;
