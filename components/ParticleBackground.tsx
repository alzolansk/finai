import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
  baseOpacity: number;
  pulseSpeed: number;
  pulsePhase: number;
  // Metamorphosis properties
  targetX: number;
  targetY: number;
  char: string;
  charOpacity: number;
  morphProgress: number;
  originalX: number;
  originalY: number;
}

type ParticleMode = 'particles' | 'text' | 'neural' | 'matrix';

interface ParticleBackgroundProps {
  particleCount?: number;
  colors?: string[];
  className?: string;
  connectionDistance?: number;
  mouseInfluence?: number;
  speed?: number;
  mode?: ParticleMode;
  chatActive?: boolean;
  isProcessing?: boolean;
}

// Characters for different modes
const AI_CHARS = '01アイウエオカキクケコ∞∑∏∫√πΩλ<>{}[]';
const FINANCE_CHARS = '$€£¥₿%+−×÷=≈≠<>∞';
const NEURAL_CHARS = '◯◉●○◎⬡⬢⬣⎔⏣';

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleCount = 60,
  colors = ['#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'],
  className = '',
  connectionDistance = 150,
  mouseInfluence = 200,
  speed = 0.3,
  mode = 'particles',
  chatActive = false,
  isProcessing = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const targetMouseRef = useRef({ x: -1000, y: -1000 });
  const frameCountRef = useRef(0);
  const currentModeRef = useRef<ParticleMode>('particles');
  const morphTransitionRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resizeCanvas = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    const getRandomChar = () => {
      const charSet = isProcessing ? AI_CHARS : FINANCE_CHARS;
      return charSet[Math.floor(Math.random() * charSet.length)];
    };

    const createParticles = () => {
      particlesRef.current = [];
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      for (let i = 0; i < particleCount; i++) {
        // Much lower base opacity for subtle background effect
        const baseOpacity = Math.random() * 0.15 + 0.08;
        const x = Math.random() * width;
        const y = Math.random() * height;
        particlesRef.current.push({
          x,
          y,
          size: Math.random() * 2 + 1.5,
          speedX: (Math.random() - 0.5) * speed,
          speedY: (Math.random() - 0.5) * speed,
          opacity: baseOpacity,
          baseOpacity,
          color: colors[Math.floor(Math.random() * colors.length)],
          pulseSpeed: Math.random() * 0.015 + 0.005,
          pulsePhase: Math.random() * Math.PI * 2,
          // Metamorphosis properties
          targetX: x,
          targetY: y,
          originalX: x,
          originalY: y,
          char: getRandomChar(),
          charOpacity: 0,
          morphProgress: 0
        });
      }
    };

    const drawParticle = (particle: Particle, isNearMouse: boolean = false) => {
      const isMorphing = chatActive || isProcessing;
      const morphAmount = particle.morphProgress;
      
      // Enhanced glow for particles near mouse
      const glowMultiplier = isNearMouse ? 4 : 2;
      const opacityMultiplier = isNearMouse ? 1 : 0.3;
      
      // Draw particle (fades out during morph)
      if (morphAmount < 1) {
        const particleOpacity = particle.opacity * (1 - morphAmount);
        
        // Draw glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * glowMultiplier
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.4, particle.color + (isNearMouse ? '60' : '20'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * glowMultiplier, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = particleOpacity * opacityMultiplier;
        ctx.fill();
        
        // Draw core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (isNearMouse ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = isNearMouse ? Math.min(1, particleOpacity * 3) : particleOpacity;
        ctx.fill();
      }
      
      // Draw character (fades in during morph)
      if (isMorphing && morphAmount > 0) {
        const charOpacity = particle.charOpacity * morphAmount;
        const fontSize = isNearMouse ? 16 : 12;
        
        ctx.font = `${fontSize}px 'Monaco', 'Menlo', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Glow effect for characters
        if (isNearMouse || isProcessing) {
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = isProcessing ? 15 : 8;
        }
        
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = charOpacity * (isNearMouse ? 0.9 : 0.4);
        ctx.fillText(particle.char, particle.x, particle.y);
        
        ctx.shadowBlur = 0;
      }
      
      ctx.globalAlpha = 1;
    };

    const connectParticles = () => {
      const particles = particlesRef.current;
      const len = particles.length;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mx > 0 && my > 0;
      
      // Background connections - very subtle
      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          const maxDistSq = connectionDistance * connectionDistance;

          if (distSq < maxDistSq) {
            const distance = Math.sqrt(distSq);
            // Much lower opacity for background connections
            const opacity = 0.08 * (1 - distance / connectionDistance);
            
            ctx.beginPath();
            ctx.strokeStyle = particles[i].color;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      
      // Mouse connections - MUCH more visible and prominent
      if (mouseActive) {
        // Draw a subtle glow at mouse position
        const mouseGlow = ctx.createRadialGradient(mx, my, 0, mx, my, mouseInfluence * 0.5);
        mouseGlow.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
        mouseGlow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(mx, my, mouseInfluence * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = mouseGlow;
        ctx.fill();
        
        particles.forEach(particle => {
          const dx = mx - particle.x;
          const dy = my - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouseInfluence) {
            // Strong, visible connection to mouse
            const opacity = 0.6 * (1 - distance / mouseInfluence);
            
            // Draw connection line with gradient
            const gradient = ctx.createLinearGradient(particle.x, particle.y, mx, my);
            gradient.addColorStop(0, particle.color);
            gradient.addColorStop(1, '#10b981');
            
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = 1.5 + (1 - distance / mouseInfluence);
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
      }
    };

    const updateParticle = (particle: Particle, time: number): boolean => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMorphing = chatActive || isProcessing;
      
      // Handle metamorphosis transition
      if (isMorphing) {
        // Smoothly increase morph progress
        particle.morphProgress = Math.min(1, particle.morphProgress + 0.02);
        particle.charOpacity = Math.min(1, particle.charOpacity + 0.03);
        
        // Randomly change character occasionally during processing
        if (isProcessing && Math.random() < 0.01) {
          particle.char = getRandomChar();
        }
        
        // Slower, more floaty movement when morphed
        particle.x += particle.speedX * 0.3;
        particle.y += particle.speedY * 0.3;
        
        // Add slight wave motion for characters
        particle.x += Math.sin(time * 0.001 + particle.pulsePhase) * 0.2;
        particle.y += Math.cos(time * 0.001 + particle.pulsePhase) * 0.15;
      } else {
        // Smoothly decrease morph progress
        particle.morphProgress = Math.max(0, particle.morphProgress - 0.03);
        particle.charOpacity = Math.max(0, particle.charOpacity - 0.04);
        
        // Normal particle movement
        particle.x += particle.speedX;
        particle.y += particle.speedY;
      }

      // Smooth mouse interaction - repulsion effect
      const dx = mouseRef.current.x - particle.x;
      const dy = mouseRef.current.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let isNearMouse = false;
      
      if (distance < mouseInfluence && distance > 0) {
        isNearMouse = true;
        const force = (mouseInfluence - distance) / mouseInfluence;
        const angle = Math.atan2(dy, dx);
        
        // Different behavior when morphed vs normal
        if (isMorphing) {
          // Attraction to mouse when in chat mode (characters gather around cursor)
          particle.x += Math.cos(angle) * force * 0.3;
          particle.y += Math.sin(angle) * force * 0.3;
          // Extra bright when near mouse in chat mode
          particle.charOpacity = Math.min(1, particle.charOpacity + force * 0.5);
        } else {
          // Normal repulsion
          particle.x -= Math.cos(angle) * force * 0.8;
          particle.y -= Math.sin(angle) * force * 0.8;
        }
        
        // STRONG boost opacity near mouse
        particle.opacity = Math.min(1, particle.baseOpacity + force * 0.8);
      } else {
        particle.opacity = particle.baseOpacity;
      }

      // Subtle pulsing opacity
      const pulseAmount = isMorphing ? 0.15 : 0.1;
      particle.opacity *= (1 - pulseAmount) + pulseAmount * Math.sin(time * particle.pulseSpeed + particle.pulsePhase);

      // Wrap around edges
      if (particle.x < -10) particle.x = width + 10;
      if (particle.x > width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = height + 10;
      if (particle.y > height + 10) particle.y = -10;
      
      return isNearMouse;
    };

    const animate = (time: number) => {
      frameCountRef.current++;
      
      // Smooth mouse position interpolation
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.1;
      
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // First pass: draw background particles (not near mouse)
      // Second pass: draw highlighted particles (near mouse) on top
      const nearMouseParticles: Particle[] = [];
      
      particlesRef.current.forEach(particle => {
        const isNearMouse = updateParticle(particle, time);
        if (isNearMouse) {
          nearMouseParticles.push(particle);
        } else {
          drawParticle(particle, false);
        }
      });
      
      // Draw connections first
      connectParticles();
      
      // Draw highlighted particles on top for emphasis
      nearMouseParticles.forEach(particle => {
        drawParticle(particle, true);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      targetMouseRef.current = { x: -1000, y: -1000 };
    };

    resizeCanvas();
    createParticles();
    animationRef.current = requestAnimationFrame(animate);

    window.addEventListener('resize', () => {
      resizeCanvas();
      createParticles();
    });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [particleCount, colors, connectionDistance, mouseInfluence, speed, chatActive, isProcessing]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
    />
  );
};

export default ParticleBackground;
