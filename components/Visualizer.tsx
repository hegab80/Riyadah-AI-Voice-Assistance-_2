import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 255
  isAgentTalking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume, isAgentTalking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = canvas.parentElement?.clientHeight || 150;
    };
    resize();
    window.addEventListener('resize', resize);

    let phase = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Base radius
      const baseRadius = 40;
      
      // Pulse effect based on volume or agent speaking state
      let pulse = 0;
      if (isAgentTalking) {
          // Automatic sine wave pulsing when agent talks (since we don't have output analyser easily)
          pulse = Math.sin(Date.now() / 150) * 20 + 20; 
          ctx.strokeStyle = '#60a5fa'; // Blue-400
      } else if (isActive && volume > 10) {
          // Mic volume reactivity
          pulse = (volume / 255) * 50;
          ctx.strokeStyle = '#34d399'; // Emerald-400
      } else {
          // Idle breathing
          pulse = Math.sin(Date.now() / 1000) * 5;
          ctx.strokeStyle = '#475569'; // Slate-600
      }

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse, 0, 2 * Math.PI);
      ctx.stroke();

      // Second ring
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse + 15, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, volume, isAgentTalking]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Visualizer;