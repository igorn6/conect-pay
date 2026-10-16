"use client";

import { useEffect, useState, useRef } from "react";

interface CountUpProps {
  to: number;
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
  from = 0,
  duration = 1.2,
  decimals = 2,
  currency = true,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpProps) {
  const [current, setCurrent] = useState(from);
  const startTimeRef = useRef<number | null>(null);
  const prevToRef = useRef(to);

  useEffect(() => {
    let animId: number;
    const startVal = prevToRef.current !== to ? prevToRef.current : from;
    prevToRef.current = to;
    startTimeRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / (duration * 1000), 1);
      const eased = easeOutCubic(progress);
      const val = startVal + (to - startVal) * eased;
      setCurrent(val);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCurrent(to);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [to, from, duration]);

  const formatted = currency
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(current)
    : `${prefix}${current.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

  return <span className={`tabular-nums font-mono ${className}`}>{formatted}</span>;
}
