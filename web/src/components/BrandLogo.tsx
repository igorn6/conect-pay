"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";

interface BrandLogoProps {
  isCollapsed?: boolean;
}

export default function BrandLogo({ isCollapsed = false }: BrandLogoProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Controle de hidratao para evitar Hydration Mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Retorna um placeholder transparente com o mesmo tamanho para evitar layout shift
    return <div className={`h-[42px] bg-transparent ${isCollapsed ? "w-[42px]" : "w-[180px]"}`} />;
  }

  // CENÃRIO B: Se o tema for light, renderizamos a logo escura.
  // Se for qualquer tema escuro (dark, n8n, authkit), renderizamos a logo clara.
  const isLightTheme = theme === "light" || theme === "jeton";
  const logoSrc = isLightTheme ? "/logo-light-smooth.png" : "/logo-dark-smooth.png";

  return (
    <div className="flex items-center h-full overflow-hidden bg-transparent select-none">
      <img
        src={logoSrc}
        alt="Conect Pay"
        className={`h-[42px] object-cover object-left transition-all duration-300 bg-transparent ${isCollapsed ? "w-[42px]" : "w-[180px]"}`}
      />
    </div>
  );
}



