import React, { useState, useRef, useEffect } from 'react';

interface TechTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const TechTooltip: React.FC<TechTooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-900'
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && (
        <div 
          className={`absolute z-50 ${positionClasses[position]} tooltip-animate`}
          role="tooltip"
        >
          <div className="relative">
            {/* Tooltip content */}
            <div className="px-3 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap">
              {/* Tech corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-emerald-500/50 rounded-tl" />
              <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-emerald-500/50 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-emerald-500/50 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-emerald-500/50 rounded-br" />
              
              {content}
            </div>
            
            {/* Arrow */}
            <div 
              className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TechTooltip;
