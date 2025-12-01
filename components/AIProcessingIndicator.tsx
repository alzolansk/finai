import React from 'react';
import { Brain, Cpu, Sparkles, Zap } from 'lucide-react';

interface AIProcessingIndicatorProps {
  variant?: 'minimal' | 'default' | 'detailed';
  text?: string;
  subtext?: string;
  className?: string;
}

const AIProcessingIndicator: React.FC<AIProcessingIndicatorProps> = ({
  variant = 'default',
  text = 'Processando',
  subtext,
  className = ''
}) => {
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full ai-thinking-dot" />
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full ai-thinking-dot" />
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full ai-thinking-dot" />
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`flex flex-col items-center gap-4 p-6 ${className}`}>
        {/* Animated brain icon with rings */}
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-2xl flex items-center justify-center">
            <Brain className="w-8 h-8 text-emerald-600 animate-neural-pulse" />
          </div>
          {/* Orbiting particles */}
          <div className="absolute inset-0 animate-radar">
            <div className="absolute -top-1 left-1/2 w-2 h-2 bg-emerald-500 rounded-full" />
          </div>
          <div className="absolute inset-0 animate-radar" style={{ animationDelay: '-1s' }}>
            <div className="absolute top-1/2 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
          </div>
          <div className="absolute inset-0 animate-radar" style={{ animationDelay: '-2s' }}>
            <div className="absolute -bottom-1 left-1/2 w-1.5 h-1.5 bg-purple-500 rounded-full" />
          </div>
        </div>
        
        {/* Text */}
        <div className="text-center">
          <p className="font-bold text-zinc-800 ai-gradient-text-animated">{text}</p>
          {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
        </div>
        
        {/* Progress bar */}
        <div className="w-48 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 animate-data-process" />
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-zinc-100 shadow-sm ${className}`}>
      {/* Animated icon */}
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl flex items-center justify-center">
          <Cpu className="w-5 h-5 text-emerald-600 animate-pulse" />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
      </div>
      
      {/* Text and dots */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700">{text}</span>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-emerald-500 rounded-full ai-thinking-dot" />
            <div className="w-1 h-1 bg-emerald-500 rounded-full ai-thinking-dot" />
            <div className="w-1 h-1 bg-emerald-500 rounded-full ai-thinking-dot" />
          </div>
        </div>
        {subtext && <p className="text-xs text-zinc-400 mt-0.5">{subtext}</p>}
      </div>
      
      {/* Sparkle */}
      <Sparkles className="w-4 h-4 text-emerald-400 animate-sparkle" />
    </div>
  );
};

export default AIProcessingIndicator;
