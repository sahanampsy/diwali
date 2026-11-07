import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/hooks';

interface Particle {
  x: number; y: number; r: number; vy: number; vx: number; hue: number; tw: number; kind: 'lantern' | 'spark';
}

/** Full-page festive backdrop: drifting lanterns and twinkling sparks. */
export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const still = prefersReducedMotion();
    let parts: Particle[] = [];

    const make = (kind: Particle['kind'], anywhere: boolean): Particle => ({
      kind,
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 20,
      r: kind === 'lantern' ? 2.5 + Math.random() * 4 : 0.6 + Math.random() * 1.4,
      vy: kind === 'lantern' ? 0.15 + Math.random() * 0.35 : 0,
      vx: (Math.random() - 0.5) * 0.15,
      hue: [38, 30, 22, 330, 45][Math.floor(Math.random() * 5)],
      tw: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = (w * h) / 12000;
      parts = [
        ...Array.from({ length: Math.round(Math.min(40, area * 0.35)) }, () => make('lantern', true)),
        ...Array.from({ length: Math.round(Math.min(120, area)) }, () => make('spark', true)),
      ];
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.tw += 0.02 + (p.kind === 'spark' ? 0.03 : 0);
        if (!still) {
          p.y -= p.vy;
          p.x += p.vx + Math.sin(p.tw * 0.5) * 0.12;
          if (p.kind === 'lantern' && p.y < -20) Object.assign(p, make('lantern', false));
        }
        const alpha = p.kind === 'spark' ? 0.25 + 0.55 * Math.abs(Math.sin(p.tw)) : 0.55 + 0.25 * Math.sin(p.tw);
        if (p.kind === 'lantern') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${alpha})`);
          g.addColorStop(0.25, `hsla(${p.hue}, 100%, 60%, ${alpha * 0.35})`);
          g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${p.hue}, 100%, 85%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255, 236, 200, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!still) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="sky" aria-hidden="true">
      <div className="sky-glow sky-glow-a" />
      <div className="sky-glow sky-glow-b" />
      <canvas ref={ref} />
    </div>
  );
}
