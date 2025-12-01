import React from 'react';

interface NeuralGridProps {
  variant?: 'default' | 'dense' | 'sparse';
  animated?: boolean;
  className?: string;
}

const NeuralGrid: React.FC<NeuralGridProps> = ({
  variant = 'default',
  animated = true,
  className = ''
}) => {
  const gridSizes = {
    default: 60,
    dense: 40,
    sparse: 100
  };

  const gridSize = gridSizes[variant];

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}>
      {/* Main grid */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      />
      
      {/* Animated scan line */}
      {animated && (
        <div 
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent animate-scan-vertical"
        />
      )}
      
      {/* Corner brackets - tech style */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-emerald-500/20 rounded-tl-lg" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-emerald-500/20 rounded-tr-lg" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-emerald-500/20 rounded-bl-lg" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-emerald-500/20 rounded-br-lg" />
      
      {/* Floating data nodes */}
      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-500/40 rounded-full animate-pulse-slow" />
      <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-500/40 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 bg-cyan-500/40 rounded-full animate-pulse-slow" style={{ animationDelay: '0.5s' }} />
      
      {/* Hexagon pattern overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <polygon 
              points="25,0 50,14.4 50,43.4 25,57.7 0,43.4 0,14.4" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="0.5"
              className="text-emerald-500"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexagons)" />
      </svg>
    </div>
  );
};

export default NeuralGrid;
