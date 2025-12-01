import React from 'react';
import { Sparkles, Cpu, Zap, Brain } from 'lucide-react';

interface AIBadgeProps {
  variant?: 'default' | 'processing' | 'success' | 'premium';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  animated?: boolean;
  className?: string;
}

const AIBadge: React.FC<AIBadgeProps> = ({
  variant = 'default',
  size = 'md',
  text,
  animated = true,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  };

  const variantClasses = {
    default: 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 text-emerald-700 border-emerald-200/50',
    processing: 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border-blue-200/50',
    success: 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-700 border-emerald-300/50',
    premium: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 border-amber-200/50'
  };

  const icons = {
    default: Sparkles,
    processing: Cpu,
    success: Zap,
    premium: Brain
  };

  const Icon = icons[variant];
  const defaultTexts = {
    default: 'IA',
    processing: 'Processando',
    success: 'Analisado',
    premium: 'Premium'
  };

  return (
    <span 
      className={`
        inline-flex items-center font-bold uppercase tracking-wider rounded-full border
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${animated && variant === 'processing' ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      <Icon 
        size={iconSizes[size]} 
        className={animated ? 'animate-subtle-bounce' : ''} 
      />
      {text || defaultTexts[variant]}
    </span>
  );
};

export default AIBadge;
