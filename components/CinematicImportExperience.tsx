import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, Sparkles, Scan, Brain, Shield, Zap } from 'lucide-react';

interface CinematicImportExperienceProps {
  fileName: string;
  isProcessing: boolean;
  onComplete?: () => void;
}

const CinematicImportExperience: React.FC<CinematicImportExperienceProps> = ({
  fileName,
  isProcessing,
  onComplete
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState<{ value: string; visible: boolean }[]>([]);
  const [binaryRain, setBinaryRain] = useState<string[]>([]);

  const stages = [
    { icon: Scan, label: 'Lendo documento', color: 'blue', bgColor: 'bg-blue-500', description: 'Escaneando pixels e caracteres do arquivo...' },
    { icon: Brain, label: 'Analisando com IA', color: 'purple', bgColor: 'bg-purple-500', description: 'Gemini processando padrões financeiros...' },
    { icon: Database, label: 'Extraindo dados', color: 'emerald', bgColor: 'bg-emerald-500', description: 'Identificando transações e categorias...' },
    { icon: Shield, label: 'Validando', color: 'amber', bgColor: 'bg-amber-500', description: 'Verificando duplicatas e inconsistências...' },
    { icon: CheckCircle, label: 'Concluído', color: 'green', bgColor: 'bg-green-500', description: 'Processamento finalizado com sucesso!' }
  ];

  const codeSnippets = [
    '> Iniciando análise do documento...',
    '> const buffer = await readFileBuffer(file);',
    '> const pixels = extractImageData(buffer);',
    '> await gemini.vision.analyze(pixels);',
    '> const patterns = detectFinancialPatterns();',
    '> transactions = parseTransactions(patterns);',
    '> categories = await AI.categorize(data);',
    '> const validated = filterDuplicates();',
    '> return { success: true, ready: true };'
  ];

  const dataExamples = [
    '💳 R$ 127,50 → Alimentação',
    '📺 R$ 89,90 → Streaming',
    '🛒 R$ 1.250,00 → Compras',
    '🚗 R$ 45,00 → Transporte',
    '💊 R$ 320,00 → Saúde',
    '🎮 R$ 67,80 → Lazer'
  ];

  // Generate particles on mount
  useEffect(() => {
    if (!isProcessing) return;
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3
    }));
    setParticles(newParticles);

    // Binary rain
    const binary = Array.from({ length: 40 }, () => 
      Array.from({ length: 8 }, () => Math.random() > 0.5 ? '1' : '0').join('')
    );
    setBinaryRain(binary);
  }, [isProcessing]);

  // Stage progression
  useEffect(() => {
    if (!isProcessing) return;
    
    const stageTimings = [2500, 5000, 7500, 9500];
    const timers: NodeJS.Timeout[] = [];
    
    stageTimings.forEach((time, index) => {
      const timer = setTimeout(() => {
        setCurrentStage(index + 1);
        if (index === 3 && onComplete) {
          setTimeout(onComplete, 1000);
        }
      }, time);
      timers.push(timer);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [isProcessing, onComplete]);

  // Typewriter effect
  useEffect(() => {
    if (!isProcessing) return;
    
    const text = stages[currentStage]?.description || '';
    setTypedText('');
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setTypedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [currentStage, isProcessing]);

  // Code lines animation
  useEffect(() => {
    if (!isProcessing) return;
    
    setCodeLines([]);
    let lineIndex = 0;
    
    const interval = setInterval(() => {
      if (lineIndex < codeSnippets.length) {
        setCodeLines(prev => [...prev, codeSnippets[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing]);

  // Scan progress animation
  useEffect(() => {
    if (!isProcessing) return;
    
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (Math.random() * 2 + 0.5);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isProcessing]);

  // Data points reveal
  useEffect(() => {
    if (!isProcessing || currentStage < 2) {
      setDataPoints([]);
      return;
    }
    
    setDataPoints(dataExamples.map(value => ({ value, visible: false })));
    
    dataExamples.forEach((_, index) => {
      setTimeout(() => {
        setDataPoints(prev => prev.map((dp, i) => 
          i === index ? { ...dp, visible: true } : dp
        ));
      }, index * 350 + 300);
    });
  }, [currentStage, isProcessing]);

  const CurrentIcon = stages[currentStage]?.icon || Scan;

  if (!isProcessing) return null;

  return (
    <div className="relative w-full max-w-2xl mx-auto overflow-hidden animate-fadeIn">
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              backgroundColor: currentStage === 0 ? '#3b82f6' : 
                              currentStage === 1 ? '#8b5cf6' : 
                              currentStage === 2 ? '#10b981' : 
                              currentStage === 3 ? '#f59e0b' : '#22c55e',
              opacity: 0.6
            }}
          />
        ))}
      </div>

      {/* Main container with glass effect */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl overflow-hidden">
        
        {/* Animated scan line */}
        <div 
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent pointer-events-none"
          style={{
            top: `${Math.min(scanProgress, 100)}%`,
            opacity: scanProgress < 100 ? 0.7 : 0,
            transition: 'top 0.15s linear, opacity 0.3s ease',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="relative">
            <div className={`w-14 h-14 md:w-16 md:h-16 ${stages[currentStage]?.bgColor} rounded-2xl flex items-center justify-center shadow-lg`}
                 style={{ boxShadow: `0 0 30px ${currentStage === 0 ? 'rgba(59, 130, 246, 0.5)' : 
                                                  currentStage === 1 ? 'rgba(139, 92, 246, 0.5)' : 
                                                  currentStage === 2 ? 'rgba(16, 185, 129, 0.5)' : 
                                                  currentStage === 3 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(34, 197, 94, 0.5)'}` }}>
              <CurrentIcon className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            {/* Pulsing ring */}
            <div className={`absolute inset-0 ${stages[currentStage]?.bgColor} rounded-2xl animate-ping opacity-30`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg md:text-xl mb-1 flex items-center gap-2">
              {stages[currentStage]?.label}
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </h3>
            <p className="text-zinc-400 text-xs md:text-sm font-mono truncate">{fileName}</p>
          </div>
          
          <div className="text-right shrink-0">
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
              {Math.min(Math.round(scanProgress), 100)}%
            </div>
            <div className="text-[10px] md:text-xs text-zinc-500 uppercase tracking-wider">processado</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-zinc-800 rounded-full mb-6 overflow-hidden relative z-10">
          <div 
            className={`h-full ${stages[currentStage]?.bgColor} rounded-full transition-all duration-300 relative overflow-hidden`}
            style={{ width: `${Math.min(scanProgress, 100)}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" 
                 style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>

        {/* Stage indicators */}
        <div className="flex items-center justify-between mb-6 px-1 relative z-10">
          {stages.slice(0, 4).map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentStage;
            const isComplete = index < currentStage;
            
            return (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500
                    ${isComplete ? 'bg-emerald-500 scale-100' : isActive ? `${s.bgColor} scale-110` : 'bg-zinc-700 scale-90'}
                    ${isActive ? 'animate-pulse' : ''}
                  `}
                  style={isComplete || isActive ? { boxShadow: `0 0 15px ${isComplete ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)'}` } : {}}>
                    {isComplete ? (
                      <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    ) : (
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                    )}
                  </div>
                  <span className={`text-[9px] md:text-[10px] mt-1.5 font-medium ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                    {s.label.split(' ')[0]}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-1 md:mx-2 transition-all duration-700 rounded-full ${index < currentStage ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Typewriter text box */}
        <div className="bg-zinc-800/60 rounded-xl p-4 mb-4 border border-zinc-700/50 relative z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">IA Processando</span>
          </div>
          <p className="text-zinc-300 font-mono text-sm min-h-[20px]">
            {typedText}
            <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 animate-pulse" />
          </p>
        </div>

        {/* Code terminal */}
        <div className="bg-black/60 rounded-xl p-4 mb-4 border border-zinc-700/50 font-mono text-xs overflow-hidden max-h-36 relative z-10 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-zinc-500 ml-2 text-[10px]">gemini-processor.ts</span>
          </div>
          <div className="space-y-1 overflow-y-auto max-h-20 scrollbar-hide">
            {codeLines.map((line, index) => (
              <div 
                key={index} 
                className="text-emerald-400 animate-fadeIn flex items-start gap-2"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="text-zinc-600 select-none shrink-0">{String(index + 1).padStart(2, '0')}</span>
                <span className="break-all">{line}</span>
              </div>
            ))}
            {codeLines.length < codeSnippets.length && (
              <div className="text-zinc-600 flex items-center gap-2">
                <span>{String(codeLines.length + 1).padStart(2, '0')}</span>
                <span className="w-2 h-3 bg-emerald-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Extracted data preview */}
        {currentStage >= 2 && dataPoints.length > 0 && (
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/50 relative z-10 backdrop-blur-sm animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Dados Extraídos</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dataPoints.map((dp, index) => (
                <div 
                  key={index}
                  className={`
                    text-xs py-2 px-3 rounded-lg transition-all duration-500 font-medium
                    ${dp.visible 
                      ? 'bg-emerald-500/20 text-emerald-300 translate-x-0 opacity-100 border border-emerald-500/30' 
                      : 'bg-zinc-700/30 text-transparent translate-x-4 opacity-0 border border-transparent'
                    }
                  `}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  {dp.value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Binary rain decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden pointer-events-none opacity-10">
          <div className="flex justify-around text-emerald-400 font-mono text-[8px] animate-pulse">
            {binaryRain.slice(0, 15).map((bin, i) => (
              <span key={i} className="opacity-50" style={{ animationDelay: `${i * 0.15}s` }}>
                {bin}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CinematicImportExperience;
