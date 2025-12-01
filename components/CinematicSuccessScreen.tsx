import React, { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, FileCheck, ArrowRight, Zap } from 'lucide-react';

interface CinematicSuccessScreenProps {
  transactionCount: number;
  documentType: 'invoice' | 'bank_statement' | null;
  dueDate?: string | null;
  issuer?: string | null;
  onContinue?: () => void;
}

const CinematicSuccessScreen: React.FC<CinematicSuccessScreenProps> = ({
  transactionCount,
  documentType,
  dueDate,
  issuer,
  onContinue
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; delay: number; color: string }[]>([]);

  useEffect(() => {
    // Staggered animations
    setTimeout(() => setShowCheckmark(true), 200);
    setTimeout(() => setShowStats(true), 800);
    setTimeout(() => setShowButton(true), 1400);

    // Generate confetti
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];
    const particles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setConfetti(particles);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto text-center overflow-hidden">
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map(particle => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full animate-bounce"
            style={{
              left: `${particle.x}%`,
              top: '-10%',
              backgroundColor: particle.color,
              animationDelay: `${particle.delay}s`,
              animationDuration: '1.5s',
              opacity: 0.8
            }}
          />
        ))}
      </div>

      {/* Success container */}
      <div className="relative bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-3xl p-8 border-2 border-emerald-200 shadow-xl">
        
        {/* Animated checkmark */}
        <div className={`
          relative w-24 h-24 mx-auto mb-6 transition-all duration-700
          ${showCheckmark ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        `}>
          <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg"
               style={{ boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)' }}>
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          
          {/* Sparkles around checkmark */}
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
          <Sparkles className="absolute -bottom-1 -left-3 w-5 h-5 text-amber-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
          <Zap className="absolute top-0 -left-4 w-4 h-4 text-blue-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Title */}
        <h2 className={`
          text-2xl font-bold text-emerald-800 mb-2 transition-all duration-500
          ${showCheckmark ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        `}>
          {documentType === 'bank_statement' ? 'Extrato Processado!' : 'Fatura Processada!'}
        </h2>

        <p className={`
          text-emerald-600 mb-6 transition-all duration-500 delay-100
          ${showCheckmark ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        `}>
          Análise concluída com sucesso
        </p>

        {/* Stats grid */}
        <div className={`
          grid grid-cols-2 gap-3 mb-6 transition-all duration-700
          ${showStats ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        `}>
          <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
            <div className="text-3xl font-bold text-emerald-600 mb-1">{transactionCount}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Transações</div>
          </div>
          
          {issuer && (
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
              <div className="text-lg font-bold text-zinc-800 mb-1 truncate">{issuer}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Emissor</div>
            </div>
          )}
          
          {dueDate && documentType === 'invoice' && (
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm col-span-2">
              <div className="text-lg font-bold text-zinc-800 mb-1">
                {new Date(dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Data de Vencimento</div>
            </div>
          )}
        </div>

        {/* Features processed */}
        <div className={`
          flex flex-wrap justify-center gap-2 mb-6 transition-all duration-700 delay-200
          ${showStats ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        `}>
          {['Categorizado', 'Filtrado', 'Validado'].map((feature, index) => (
            <span 
              key={feature}
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CheckCircle className="w-3 h-3" />
              {feature}
            </span>
          ))}
        </div>

        {/* Continue button */}
        {onContinue && (
          <button
            onClick={onContinue}
            className={`
              w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold 
              transition-all duration-500 flex items-center justify-center gap-2
              hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
              ${showButton ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
            `}
          >
            <FileCheck className="w-5 h-5" />
            Revisar Transações
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CinematicSuccessScreen;
