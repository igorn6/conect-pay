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
    <div className={`overflow-hidden pointer-events-none ${className}`}>
      {/* Quiet Ambient Depth - Zero Chromatic Noise */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background: "radial-gradient(1200px circle at 50% 0%, rgba(255, 255, 255, 0.02) 0%, transparent 70%)",
        }}
      />

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
