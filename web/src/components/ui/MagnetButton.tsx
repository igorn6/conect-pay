"use client";

import React, { useRef, useState, useCallback } from "react";

interface MagnetButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  magnetStrength?: number;
  className?: string;
}

export default function MagnetButton({
  children,
  magnetStrength = 0.25,
  className = "",
  style,
  ...props
}: MagnetButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = (e.clientX - centerX) * magnetStrength;
    const dy = (e.clientY - centerY) * magnetStrength;

    setOffset({ x: dx, y: dy });
  }, [magnetStrength]);

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out will-change-transform cursor-pointer ${className}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
