import React, { useState } from 'react';
import { UserSettings } from '../types';
import { calculateBudgetGoal } from '../services/geminiService';
import { ArrowRight, Check, Target, Wallet, Loader2, Sparkles } from 'lucide-react';
import FloatingOrbs from './FloatingOrbs';

interface OnboardingProps {
  onComplete: (settings: UserSettings) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [income, setIncome] = useState<string>('');
  const [fixedExpenses, setFixedExpenses] = useState<{description: string, amount: string}[]>([
      { description: 'Aluguel / Moradia', amount: '' },
      { description: 'Internet / Telefone', amount: '' },
      { description: 'Academia', amount: '' }
  ]);
  const [customGoal, setCustomGoal] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{recommendedGoal: number, reasoning: string} | null>(null);

  const updateFixedExpense = (index: number, field: 'description' | 'amount', value: string) => {
    const newExpenses = [...fixedExpenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setFixedExpenses(newExpenses);
  };

  const handleCalculateGoal = async () => {
    setLoading(true);
    const validExpenses = fixedExpenses
        .filter(e => e.amount && Number(e.amount) > 0)
        .map(e => ({ description: e.description, amount: Number(e.amount) }));
    
    const result = await calculateBudgetGoal(Number(income), validExpenses);
    setAiSuggestion(result);
    setCustomGoal(result.recommendedGoal);
    setLoading(false);
    setStep(3);
  };

  const handleFinish = () => {
    const validExpenses = fixedExpenses
        .filter(e => e.amount && Number(e.amount) > 0)
        .map(e => ({ description: e.description, amount: Number(e.amount) }));

    const settings: UserSettings = {
        monthlyIncome: Number(income),
        savingsGoal: Number(customGoal),
        onboardingCompleted: true,
        fixedExpenses: validExpenses
    };
    onComplete(settings);
  };

  const handleSkip = () => {
    // Skip onboarding with default values
    const settings: UserSettings = {
        monthlyIncome: 0,
        savingsGoal: 0,
        onboardingCompleted: true,
        fixedExpenses: []
    };
    onComplete(settings);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 z-[100] flex flex-col items-center justify-center p-6 text-zinc-900 overflow-hidden">
       {/* Background Effects */}
       <FloatingOrbs variant="onboarding" />
       
       {/* Decorative sparkles */}
       <div className="absolute top-20 left-20 text-emerald-400 animate-sparkle opacity-60">
         <Sparkles size={24} />
       </div>
       <div className="absolute bottom-32 right-16 text-blue-400 animate-sparkle opacity-60" style={{ animationDelay: '1s' }}>
         <Sparkles size={20} />
       </div>
       <div className="absolute top-1/3 right-24 text-purple-400 animate-sparkle opacity-60" style={{ animationDelay: '0.5s' }}>
         <Sparkles size={16} />
       </div>
       
       <div className="max-w-md w-full relative z-10">

         {/* Progress */}
         <div className="flex gap-2 mb-10 justify-center">
            {[1, 2, 3].map(i => (
                <div 
                  key={i} 
                  className={`h-1.5 w-12 rounded-full transition-all duration-500 ${i <= step ? 'bg-gradient-to-r from-zinc-900 to-emerald-600 shadow-sm' : 'bg-zinc-200'}`}
                  style={{ transitionDelay: `${i * 50}ms` }}
                ></div>
            ))}
         </div>

         {/* Step 1: Income */}
         {step === 1 && (
            <div className="animate-slideUpFade">
                <div className="w-16 h-16 bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-zinc-200/50 animate-subtle-bounce">
                    <Wallet className="w-8 h-8 text-zinc-700" />
                </div>
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 bg-clip-text text-transparent">Vamos começar pelo básico.</h2>
                <p className="text-zinc-500 mb-8">Para ajudar a controlar suas finanças, preciso saber qual é a sua renda mensal aproximada.</p>
                
                <label className="block text-xs font-bold uppercase text-zinc-400 tracking-wider mb-2">Renda Mensal Líquida</label>
                <div className="relative">
                  <input 
                      type="number" 
                      value={income}
                      onChange={e => setIncome(e.target.value)}
                      className="w-full text-4xl font-bold border-b-2 border-zinc-200 py-2 focus:outline-none focus:border-emerald-500 placeholder-zinc-200 transition-all bg-transparent"
                      placeholder="0.00"
                      autoFocus
                  />
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-300" style={{ width: income ? '100%' : '0%' }}></div>
                </div>

                <button 
                    disabled={!income}
                    onClick={() => setStep(2)}
                    className="mt-10 w-full bg-zinc-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-900/20 disabled:opacity-50 transition-all duration-300 group shine-effect"
                >
                    Continuar <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
         )}

         {/* Step 2: Fixed Expenses */}
         {step === 2 && (
             <div className="animate-fadeIn">
                <h2 className="text-2xl font-bold mb-2">Gastos Fixos & Assinaturas</h2>
                <p className="text-zinc-500 mb-6 text-sm">Liste o que você paga todo mês sem falta. Isso ajuda a calcular o que sobra.</p>
                
                <div className="space-y-4 mb-8 max-h-[40vh] overflow-y-auto">
                    {fixedExpenses.map((exp, idx) => (
                        <div key={idx} className="flex gap-3">
                            <input 
                                className="flex-1 bg-zinc-50 p-3 rounded-xl border border-transparent focus:bg-white focus:border-zinc-200 outline-none text-sm"
                                placeholder="Nome (Ex: Netflix)"
                                value={exp.description}
                                onChange={e => updateFixedExpense(idx, 'description', e.target.value)}
                            />
                            <input 
                                type="number"
                                className="w-24 bg-zinc-50 p-3 rounded-xl border border-transparent focus:bg-white focus:border-zinc-200 outline-none text-sm font-bold"
                                placeholder="R$"
                                value={exp.amount}
                                onChange={e => updateFixedExpense(idx, 'amount', e.target.value)}
                            />
                        </div>
                    ))}
                    <button 
                        onClick={() => setFixedExpenses([...fixedExpenses, {description: '', amount: ''}])}
                        className="text-sm text-emerald-600 font-bold hover:underline"
                    >
                        + Adicionar outro
                    </button>
                </div>

                <button 
                    onClick={handleCalculateGoal}
                    className="w-full bg-zinc-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all"
                >
                    {loading ? <Loader2 className="animate-spin" /> : 'Calcular Minha Meta'}
                </button>
             </div>
         )}

         {/* Step 3: Goal */}
         {step === 3 && aiSuggestion && (
             <div className="animate-slideUpFade text-center">
                 <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200/50 relative">
                    <Target className="w-10 h-10 text-emerald-600 animate-subtle-bounce" />
                    {/* Success ring animation */}
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-glow-ring opacity-50"></div>
                 </div>
                 <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">Sugestão FinAI</h2>
                 <p className="text-zinc-500 mb-6 text-sm">{aiSuggestion.reasoning}</p>

                 <div className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-2xl p-6 mb-8 shadow-xl shadow-emerald-100/30 card-lift">
                    <p className="text-xs uppercase text-zinc-400 font-bold mb-2">Meta de Economia Mensal</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-zinc-400 text-2xl font-light">R$</span>
                        <input 
                            type="number"
                            value={customGoal || 0}
                            onChange={(e) => setCustomGoal(Number(e.target.value))}
                            className="text-4xl font-bold text-zinc-900 w-40 text-center outline-none border-b-2 border-dashed border-zinc-300 focus:border-emerald-500 transition-colors bg-transparent"
                        />
                    </div>
                 </div>

                 <button 
                    onClick={handleFinish}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-900/20 transition-all duration-300 group shine-effect"
                >
                    <Check className="group-hover:scale-110 transition-transform" /> Finalizar Configuração
                </button>
             </div>
         )}

         {/* Discrete Skip Button */}
         <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-4">
            <button
               onClick={handleSkip}
               className="text-xs text-zinc-300 hover:text-zinc-500 transition-colors underline"
               title="Pular configuração inicial"
            >
               pular
            </button>
         </div>

       </div>
    </div>
  );
};

export default Onboarding;