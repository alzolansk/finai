import React from 'react';

interface TechCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'neon' | 'gradient';
  glowColor?: 'emerald' | 'blue' | 'purple' | 'cyan';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

const TechCard: React.FC<TechCardProps> = ({
  children,
  variant = 'default',
  glowColor = 'emerald',
  animated = false,
  className = '',
  onClick
}) => {
  const glowColors = {
    emerald: 'hover:shadow-emerald-500/20 hover:border-emerald-500/30',
    blue: 'hover:shadow-blue-500/20 hover:border-blue-500/30',
    purple: 'hover:shadow-purple-500/20 hover:border-purple-500/30',
    cyan: 'hover:shadow-cyan-500/20 hover:border-cyan-500/30'
  };

  const neonColors = {
    emerald: 'cyber-glow',
    blue: 'cyber-glow-blue',
    purple: 'neon-purple',
    cyan: 'neon-blue'
  };

  const baseClasses = 'relative rounded-2xl transition-all duration-300';
  
  const variantClasses = {
    default: `bg-white border border-zinc-100 shadow-sm hover:shadow-lg ${glowColors[glowColor]}`,
    glass: 'glass-card hover:bg-white/80',
    neon: `bg-zinc-900 border border-zinc-800 text-white hover:${neonColors[glowColor]}`,
    gradient: 'bg-gradient-to-br from-white to-zinc-50 border border-zinc-100 shadow-sm hover:shadow-lg'
  };

  return (
    <div 
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${animated ? 'tech-card' : ''}
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Corner accents for tech feel */}
      {variant === 'neon' && (
        <>
          <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-emerald-500/50 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-emerald-500/50 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-emerald-500/50 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-emerald-500/50 rounded-br-lg" />
        </>
      )}
      
      {/* Scan line effect for animated cards */}
      {animated && variant === 'neon' && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent animate-scan-vertical" />
        </div>
      )}
      
      {children}
    </div>
  );
};

export default TechCard;
