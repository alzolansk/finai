import React, { useEffect, useState } from 'react';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

interface SparkleEffectProps {
  children: React.ReactNode;
  color?: string;
  count?: number;
  className?: string;
}

const SparkleEffect: React.FC<SparkleEffectProps> = ({
  children,
  color = '#10b981',
  count = 3,
  className = ''
}) => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const generateSparkle = (): Sparkle => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 10 + 5,
      color,
      delay: Math.random() * 2,
    });

    const initialSparkles = Array.from({ length: count }, generateSparkle);
    setSparkles(initialSparkles);

    const interval = setInterval(() => {
      setSparkles(prev => {
        const newSparkles = [...prev];
        const indexToReplace = Math.floor(Math.random() * newSparkles.length);
        newSparkles[indexToReplace] = generateSparkle();
        return newSparkles;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [color, count]);

  return (
    <span className={`relative inline-block ${className}`}>
      {sparkles.map(sparkle => (
        <svg
          key={sparkle.id}
          className="absolute pointer-events-none animate-sparkle"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: `${sparkle.delay}s`,
          }}
          viewBox="0 0 160 160"
          fill="none"
        >
          <path
            d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z"
            fill={sparkle.color}
          />
        </svg>
      ))}
      {children}
    </span>
  );
};

export default SparkleEffect;
