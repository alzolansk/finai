import React from 'react';

interface FloatingOrbsProps {
  variant?: 'default' | 'onboarding' | 'success';
}

const FloatingOrbs: React.FC<FloatingOrbsProps> = ({ variant = 'default' }) => {
  const orbConfigs = {
    default: [
      { size: 300, color: 'emerald', x: '-5%', y: '-10%', delay: 0, blur: 80 },
      { size: 400, color: 'blue', x: '80%', y: '20%', delay: 2, blur: 100 },
      { size: 250, color: 'purple', x: '10%', y: '70%', delay: 4, blur: 70 },
      { size: 200, color: 'amber', x: '70%', y: '80%', delay: 1, blur: 60 },
    ],
    onboarding: [
      { size: 500, color: 'emerald', x: '50%', y: '30%', delay: 0, blur: 120 },
      { size: 300, color: 'blue', x: '20%', y: '60%', delay: 1.5, blur: 80 },
      { size: 350, color: 'purple', x: '80%', y: '70%', delay: 3, blur: 90 },
    ],
    success: [
      { size: 400, color: 'emerald', x: '50%', y: '40%', delay: 0, blur: 100 },
      { size: 300, color: 'green', x: '30%', y: '60%', delay: 1, blur: 80 },
      { size: 250, color: 'teal', x: '70%', y: '30%', delay: 2, blur: 70 },
    ],
  };

  const colorMap: Record<string, string> = {
    emerald: 'rgba(16, 185, 129, 0.15)',
    blue: 'rgba(59, 130, 246, 0.12)',
    purple: 'rgba(139, 92, 246, 0.12)',
    amber: 'rgba(245, 158, 11, 0.1)',
    green: 'rgba(34, 197, 94, 0.15)',
    teal: 'rgba(20, 184, 166, 0.12)',
  };

  const orbs = orbConfigs[variant];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {orbs.map((orb, index) => (
        <div
          key={index}
          className="absolute rounded-full animate-float-orb"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${colorMap[orb.color]} 0%, transparent 70%)`,
            left: orb.x,
            top: orb.y,
            filter: `blur(${orb.blur}px)`,
            animationDelay: `${orb.delay}s`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
};

export default FloatingOrbs;
