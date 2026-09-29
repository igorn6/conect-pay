"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark" | "n8n" | "authkit" | "jeton";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  changeThemeWithTransition: (newTheme: Theme) => void;
  isTransitioning: boolean;
  transitionProgress: number;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("@conectpay/theme") as Theme;
    if (stored === "light" || stored === "dark" || stored === "n8n" || stored === "authkit" || stored === "jeton") {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    root.classList.remove("light-theme", "theme-n8n", "theme-authkit", "theme-jeton");
    
    if (theme === "light") {
      root.classList.add("light-theme");
    } else if (theme === "n8n") {
      root.classList.add("theme-n8n");
    } else if (theme === "authkit") {
      root.classList.add("theme-authkit");
    } else if (theme === "jeton") {
      root.classList.add("theme-jeton");
    }
    
    localStorage.setItem("@conectpay/theme", theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const changeThemeWithTransition = (newTheme: Theme) => {
    if (theme === newTheme || isTransitioning) return;
    
    setIsTransitioning(true);
    setTransitionProgress(0);

    const duration = 1500; // 1.5s
    const intervalTime = 30;
    const steps = duration / intervalTime;
    let currentStep = 0;
    let themeChanged = false;

    const interval = setInterval(() => {
      currentStep++;
      const progress = (currentStep / steps) * 100;
      setTransitionProgress(progress);

      if (progress >= 50 && !themeChanged) {
        setThemeState(newTheme);
        themeChanged = true;
      }

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsTransitioning(false);
          setTransitionProgress(0);
        }, 300);
      }
    }, intervalTime);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, changeThemeWithTransition, isTransitioning, transitionProgress }}>
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

