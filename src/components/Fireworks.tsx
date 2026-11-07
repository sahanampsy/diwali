import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/hooks';

interface Spark { x: number; y: number; vx: number; vy: number; life: number; hue: number }

/** Bursts of fireworks over the whole screen for `durationMs`. */
export function Fireworks({ durationMs = 4500 }: { durationMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const sparks: Spark[] = [];
    const hues = [40, 28, 330, 50, 15, 300];
    const start = performance.now();
    let last = 0, raf = 0;

    const burst = () => {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.12 + Math.random() * 0.4);
      const hue = hues[Math.floor(Math.random() * hues.length)];
      const n = 70 + Math.floor(Math.random() * 40);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const sp = (2 + Math.random() * 4) * dpr;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: hue + Math.random() * 20 });
      }
    };

    const tick = (t: number) => {
      const elapsed = t - start;
      if (elapsed < durationMs && t - last > 380) {
        burst();
        last = t;
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.975;
        s.vy = s.vy * 0.975 + 0.06 * dpr;
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `hsla(${s.hue}, 100%, ${55 + s.life * 25}%, ${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      if (elapsed < durationMs + 3000 || sparks.length) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
