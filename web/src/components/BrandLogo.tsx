"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface BrandLogoProps {
  isCollapsed?: boolean;
  forceTheme?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export default function BrandLogo({
  isCollapsed = false,
  forceTheme,
  size = "md",
  className = "",
}: BrandLogoProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dimensions = {
    sm: { h: "h-[34px]", w: isCollapsed ? "w-[34px]" : "w-[145px]" },
    md: { h: "h-[42px]", w: isCollapsed ? "w-[42px]" : "w-[180px]" },
    lg: { h: "h-[54px]", w: isCollapsed ? "w-[54px]" : "w-[230px]" },
    xl: { h: "h-[68px]", w: isCollapsed ? "w-[68px]" : "w-[290px]" },
    "2xl": { h: "h-[84px]", w: isCollapsed ? "w-[84px]" : "w-[355px]" },
  }[size];

  if (!mounted) {
    return <div className={`${dimensions.h} ${dimensions.w} bg-transparent ${className}`} />;
  }

  // Se o tema for light, renderizamos a logo escura.
  // Se for qualquer tema escuro, renderizamos a logo clara.
  const activeTheme = forceTheme || theme;
  const isLightTheme = activeTheme === "light" || activeTheme === "jeton";
  const logoSrc = isLightTheme ? "/logo-light-smooth.png" : "/logo-dark-smooth.png";

  return (
    <div className={`flex items-center overflow-hidden bg-transparent select-none ${className}`}>
      <img
        src={logoSrc}
        alt="Conect Pay"
        className={`${dimensions.h} ${dimensions.w} object-cover object-left transition-all duration-300 bg-transparent`}
      />
    </div>
  );
}
