"use client";

import React from "react";

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: "subtle" | "medium" | "vibrant";
}

export default function AuroraBackground({
  children,
  className = "",
  intensity = "subtle",
}: AuroraBackgroundProps) {
  const opacityMap = {
    subtle: "opacity-35",
    medium: "opacity-55",
    vibrant: "opacity-80",
  };

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Aurora Ambient Mesh */}
      <div
        className={`pointer-events-none absolute -inset-[100px] ${opacityMap[intensity]} blur-[90px] mix-blend-screen transition-opacity duration-1000 -z-10`}
        aria-hidden="true"
      >
        {/* Glow 1: Emerald Primary */}
        <div
          className="absolute top-1/4 left-1/4 w-[45vw] h-[45vw] rounded-full animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)",
            animationDuration: "12s",
          }}
        />

        {/* Glow 2: Deep Teal / Ocean */}
        <div
          className="absolute top-1/3 right-1/4 w-[40vw] h-[40vw] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%)",
            animation: "aurora-float 22s ease-in-out infinite alternate",
          }}
        />

        {/* Glow 3: Warm Amber Accent */}
        <div
          className="absolute bottom-1/4 left-1/3 w-[35vw] h-[35vw] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 65%)",
            animation: "aurora-float-reverse 18s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Film Grain Paper Noise Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay -z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {children}
    </div>
  );
}
