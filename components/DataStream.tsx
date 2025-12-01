import React, { useEffect, useState } from 'react';

interface DataStreamProps {
  active?: boolean;
  direction?: 'vertical' | 'horizontal';
  density?: 'low' | 'medium' | 'high';
  className?: string;
}

const DataStream: React.FC<DataStreamProps> = ({
  active = true,
  direction = 'vertical',
  density = 'medium',
  className = ''
}) => {
  const [streams, setStreams] = useState<Array<{ id: number; x: number; delay: number; speed: number; chars: string[] }>>([]);

  const densityCount = {
    low: 8,
    medium: 15,
    high: 25
  };

  const chars = '01アイウエオカキクケコサシスセソタチツテト'.split('');

  useEffect(() => {
    if (!active) {
      setStreams([]);
      return;
    }

    const count = densityCount[density];
    const newStreams = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (i / count) * 100 + Math.random() * (100 / count),
      delay: Math.random() * 5,
      speed: 3 + Math.random() * 4,
      chars: Array.from({ length: 8 + Math.floor(Math.random() * 8) }, () => 
        chars[Math.floor(Math.random() * chars.length)]
      )
    }));
    setStreams(newStreams);
  }, [active, density]);

  if (!active) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden z-0 ${className}`}>
      {streams.map(stream => (
        <div
          key={stream.id}
          className={`absolute ${direction === 'vertical' ? 'flex flex-col' : 'flex flex-row'}`}
          style={{
            [direction === 'vertical' ? 'left' : 'top']: `${stream.x}%`,
            animation: `${direction === 'vertical' ? 'data-fall' : 'data-slide'} ${stream.speed}s linear infinite`,
            animationDelay: `${stream.delay}s`,
          }}
        >
          {stream.chars.map((char, i) => (
            <span
              key={i}
              className="text-emerald-500/30 font-mono text-xs"
              style={{
                opacity: 1 - (i / stream.chars.length) * 0.8,
                textShadow: i === 0 ? '0 0 8px rgba(16, 185, 129, 0.8)' : 'none',
              }}
            >
              {char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default DataStream;
