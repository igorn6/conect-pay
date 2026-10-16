"use client";

import { useEffect, useState, useRef } from "react";

interface CountUpProps {
  to?: number;
  value?: number;
  from?: number;
  duration?: number;
  decimals?: number;
  currency?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function CountUp({
  to,
  value,
  from = 0,
  duration = 1.0,
  decimals,
  currency,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpProps) {
  // Safe target calculation: accept either `to` or `value`
  const rawTarget = to !== undefined ? to : (value !== undefined ? value : 0);
  const target = Number.isFinite(Number(rawTarget)) ? Number(rawTarget) : 0;
  
  // Sensible defaults: if currency is explicitly set, use it; otherwise if decimals is 0, default currency to false
  const resolvedDecimals = decimals !== undefined ? decimals : (currency ? 2 : 0);
  const resolvedCurrency = currency !== undefined ? currency : (resolvedDecimals > 0 && decimals !== 0);

  const [current, setCurrent] = useState<number>(from);
  const startTimeRef = useRef<number | null>(null);
  const prevToRef = useRef<number>(target);

  useEffect(() => {
    let animId: number;
    const startVal = prevToRef.current !== target ? prevToRef.current : from;
    prevToRef.current = target;
    startTimeRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / (Math.max(duration, 0.1) * 1000), 1);
      const eased = easeOutCubic(progress);
      const val = startVal + (target - startVal) * eased;
      setCurrent(Number.isFinite(val) ? val : target);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, from, duration]);

  const safeCurrent = Number.isFinite(current) ? current : target;

  let formatted = "";
  if (resolvedCurrency) {
    formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: resolvedDecimals,
      maximumFractionDigits: resolvedDecimals,
    }).format(safeCurrent);
  } else {
    formatted = `${prefix}${safeCurrent.toLocaleString("pt-BR", {
      minimumFractionDigits: resolvedDecimals,
      maximumFractionDigits: resolvedDecimals,
    })}${suffix}`;
  }

  return <span className={`tabular-nums font-mono ${className}`}>{formatted}</span>;
}
