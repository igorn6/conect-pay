const fs = require('fs');
const path = require('path');

const themeContextCode = `"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Carrega o tema do localStorage apenas no client-side
    const stored = localStorage.getItem("@conectpay/theme") as Theme;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Aplica a classe no HTML element para variáveis CSS globais funcionarem perfeitamente
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
    
    localStorage.setItem("@conectpay/theme", theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === "dark" ? "light" : "dark");
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Previne Hydration Mismatch renderizando apenas APÓS a montagem
  // Ou melhor, renderiza invisível/sem alterar o dom antes de montar
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div style={{ visibility: mounted ? "visible" : "hidden", minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
`;

fs.writeFileSync(path.join(process.cwd(), "src/contexts/ThemeContext.tsx"), themeContextCode);
console.log("ThemeContext.tsx created!");
