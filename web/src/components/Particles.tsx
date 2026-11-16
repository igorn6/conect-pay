"use client";

import { useEffect, useRef } from "react";
import type { WeatherVisualCondition } from "@/lib/weather";

interface ParticlesProps {
  condition?: WeatherVisualCondition;
}

interface DropOrParticle {
  x: number;
  y: number;
  size: number;
  length: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

export default function Particles({ condition = "SUNNY" }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animationFrameId = 0;
    let items: DropOrParticle[] = [];
    const isRain = condition === "RAIN" || condition === "STORM";
    const isStorm = condition === "STORM";

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    const createItem = (randomY = true): DropOrParticle => {
      if (isRain) {
        const speedY = isStorm
          ? Math.random() * 8 + 13
          : Math.random() * 5 + 9;
        return {
          x: Math.random() * (canvas.width + 120) - 60,
          y: randomY ? Math.random() * canvas.height : -24,
          size: isStorm ? Math.random() * 0.9 + 0.9 : Math.random() * 0.7 + 0.7,
          length: isStorm ? Math.random() * 14 + 14 : Math.random() * 10 + 10,
          speedX: isStorm ? -2.4 : -1.3,
          speedY,
          opacity: isStorm
            ? Math.random() * 0.35 + 0.2
            : Math.random() * 0.28 + 0.14,
        };
      }

      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.3,
        length: 0,
        speedX: Math.random() * 0.22 - 0.11,
        speedY: Math.random() * 0.22 - 0.11,
        opacity: Math.random() * 0.28 + 0.08,
      };
    };

    const init = () => {
      resizeCanvas();
      const count = isStorm ? 140 : isRain ? 95 : 40;
      items = Array.from({ length: count }, () => createItem(true));
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        p.x += p.speedX;
        p.y += p.speedY;

        if (isRain) {
          if (p.y > canvas.height + 24 || p.x < -80) {
            const reset = createItem(false);
            p.x = reset.x;
            p.y = reset.y;
          }
          ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 1.15, p.y + p.length);
          ctx.stroke();
        } else {
          if (p.x < 0 || p.x > canvas.width) p.speedX = -p.speedX;
          if (p.y < 0 || p.y > canvas.height) p.speedY = -p.speedY;
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener("resize", init);
    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(animationFrameId);
    };
  }, [condition]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}
