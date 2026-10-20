"use client";

import { useEffect, useState, useRef } from "react";

interface AnimatedCurrencyProps {
  value?: number | string | null;
  duration?: number; // Duração em ms (padrão: 400ms)
  showPrefix?: boolean; // Se renderiza o prefixo R$ (padrão: true)
  prefix?: string; // Prefixo monetário (padrão: "R$ ")
  prefixClassName?: string;
  className?: string;
  decimals?: number; // Casas decimais (padrão: 2)
}

/**
 * Hook utilitário para contagem progressiva leve com requestAnimationFrame e easeOutQuart.
 */
export function useAnimatedNumber(target: number, duration: number = 400): number {
  const [current, setCurrent] = useState<number>(Number.isFinite(target) ? target : 0);
  const prevTargetRef = useRef<number>(Number.isFinite(target) ? target : 0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const validTarget = Number.isFinite(target) ? target : 0;

    // Acessibilidade: respeita preferência do sistema por redução de movimento
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(validTarget);
      prevTargetRef.current = validTarget;
      return;
    }

    const startVal = prevTargetRef.current;
    prevTargetRef.current = validTarget;

    if (Math.abs(startVal - validTarget) < 0.001) {
      setCurrent(validTarget);
      return;
    }

    let animId: number;
    startTimeRef.current = null;

    // Curva easeOutQuart: suave desaceleração progressiva
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / Math.max(duration, 50), 1);
      const eased = easeOutQuart(progress);
      const nextVal = startVal + (validTarget - startVal) * eased;

      setCurrent(nextVal);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCurrent(validTarget);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return current;
}

/**
 * Micro-componente reutilizável para exibição de valores financeiros com contagem animada.
 * Garante apenas UM prefixo "R$" limpo, alinhado e sem duplicidades no DOM.
 */
export default function AnimatedCurrency({
  value = 0,
  duration = 400,
  showPrefix = true,
  prefix = "R$ ",
  prefixClassName,
  className = "",
  decimals = 2,
}: AnimatedCurrencyProps) {
  const numericTarget = typeof value === "number"
    ? (Number.isFinite(value) ? value : 0)
    : Number(String(value || "0").replace(/[^0-9.-]+/g, "")) || 0;

  const animatedValue = useAnimatedNumber(numericTarget, duration);

  const formattedNumber = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(animatedValue);

  return (
    <span className={`inline-flex items-baseline tabular-nums font-mono ${className}`}>
      {showPrefix && (
        <span className={prefixClassName ?? "opacity-85 mr-0.5 font-normal"}>
          {prefix}
        </span>
      )}
      <span>{formattedNumber}</span>
    </span>
  );
}
