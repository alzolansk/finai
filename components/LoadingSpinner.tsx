import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dots' | 'pulse' | 'ring';
  color?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  color = 'emerald',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const colorClasses: Record<string, string> = {
    emerald: 'border-emerald-500',
    blue: 'border-blue-500',
    purple: 'border-purple-500',
    zinc: 'border-zinc-500',
  };

  const dotColorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    zinc: 'bg-zinc-500',
  };

  if (variant === 'dots') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'} ${dotColorClasses[color]} rounded-full animate-bounce`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <div className={`absolute inset-0 ${dotColorClasses[color]} rounded-full animate-ping opacity-75`} />
        <div className={`relative ${sizeClasses[size]} ${dotColorClasses[color]} rounded-full`} />
      </div>
    );
  }

  if (variant === 'ring') {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <div className={`absolute inset-0 border-2 ${colorClasses[color]} rounded-full opacity-25`} />
        <div 
          className={`absolute inset-0 border-2 border-transparent ${colorClasses[color]} border-t-current rounded-full animate-spin`}
          style={{ borderTopColor: 'currentColor' }}
        />
      </div>
    );
  }

  // Default spinner
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className={`${sizeClasses[size]} border-2 border-zinc-200 ${colorClasses[color]} border-t-current rounded-full animate-spin`} />
    </div>
  );
};

export default LoadingSpinner;
