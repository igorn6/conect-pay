"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Eye, EyeOff, Sun, Sunset, Moon, CloudRain, Cloud, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Particles from "@/components/Particles";

const WEATHER_OPTIONS = [
  { id: "auto", name: "Tempo Real", icon: Sparkles, file: null },
  { id: "sunny", name: "Sol", icon: Sun, file: "/weather/sunny.jpg" },
  { id: "sunset", name: "Pôr do Sol", icon: Sunset, file: "/weather/sunset.jpg" },
  { id: "night", name: "Noite", icon: Moon, file: "/weather/night.jpg" },
  { id: "rainy", name: "Chuva", icon: CloudRain, file: "/weather/rainy.jpg" },
  { id: "cloudy", name: "Nublado", icon: Cloud, file: "/weather/cloudy.jpg" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [bgImage, setBgImage] = useState("/weather/sunny.jpg");
  const [bgReady, setBgReady] = useState(false);
  const [manualWeather, setManualWeather] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      if (!ipRes.ok) throw new Error("IP fetch failed");
      const locationData = await ipRes.json();
      const lat = locationData.latitude;
      const lon = locationData.longitude;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      if (!weatherRes.ok) throw new Error("Weather fetch failed");
      const weatherData = await weatherRes.json();
      
      const { weathercode, is_day } = weatherData.current_weather;
      const currentHour = new Date().getHours();
      const isSunset = is_day === 1 && currentHour >= 17 && currentHour <= 19;

      let image = "/weather/sunny.jpg";

      if (isSunset) {
        image = "/weather/sunset.jpg";
      } else if (is_day === 0) {
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weathercode)) {
          image = "/weather/rainy.jpg";
        } else {
          image = "/weather/night.jpg";
        }
      } else {
        if ([0].includes(weathercode)) {
          image = "/weather/sunny.jpg";
        } else if ([1, 2, 3, 45, 48].includes(weathercode)) {
          image = "/weather/cloudy.jpg";
        } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weathercode)) {
          image = "/weather/rainy.jpg";
        } else {
          image = "/weather/cloudy.jpg"; 
        }
      }

      const img = new Image();
      img.src = image;
      img.onload = () => {
        setBgImage(image);
        setBgReady(true);
      };
    } catch (e) {
      console.error("Failed to fetch dynamic weather", e);
      setBgImage("/weather/sunny.jpg");
      setBgReady(true);
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("login_weather_preference") : null;
    if (saved) {
      setManualWeather(saved);
    } else {
      fetchWeather();
    }
  }, [fetchWeather]);

  useEffect(() => {
    if (manualWeather) {
      setBgReady(false);
      const img = new Image();
      img.src = manualWeather;
      img.onload = () => {
        setBgImage(manualWeather);
        setBgReady(true);
      };
    }
  }, [manualWeather]);

  const handleSelectWeather = (opt: typeof WEATHER_OPTIONS[number]) => {
    if (opt.id === "auto") {
      setManualWeather(null);
      localStorage.removeItem("login_weather_preference");
      fetchWeather();
    } else if (opt.file) {
      setManualWeather(opt.file);
      localStorage.setItem("login_weather_preference", opt.file);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Parallax effect: subtle movement based on mouse position inside the image panel
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 30; // max 15px
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 30;
    setMousePos({ x, y });
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0A0A0A] overflow-hidden font-sans">
      
      {/* Left Side: Image (less than half, ~40%) */}
      <div 
        className="hidden lg:block w-[40%] relative overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        
        {/* Mouse Parallax Wrapper */}
        <div 
          className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out"
          style={{ transform: `translate(${-mousePos.x}px, ${-mousePos.y}px) scale(1.05)` }}
        >
          {/* The Background Image with Handheld Sway */}
          <div 
            className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out animate-weather-sway ${bgReady ? "opacity-100" : "opacity-0"}`}
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          
          {/* Dynamic Weather Overlays */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${bgReady ? "opacity-100" : "opacity-0"}`}>
            {bgImage.includes("rainy") && (
              <>
                <div className="weather-rain-layer-1 z-0" />
                <div className="weather-rain-layer-2 z-0" />
              </>
            )}

            {bgImage.includes("night") && (
              <>
                <div className="shooting-star star-1 z-0" />
                <div className="shooting-star star-2 z-0" />
                <div className="shooting-star star-3 z-0" />
                <div className="shooting-star star-4 z-0" />
              </>
            )}

            {bgImage.includes("sunny") && (
              <>
                <div className="weather-birds z-0" />
                <div className="weather-airplane z-0" />
              </>
            )}

            {bgImage.includes("sunset") && (
              <div className="weather-rays z-0" />
            )}
          </div>
        </div>

        {/* Gradient fade to fake black (#0A0A0A) */}
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-r from-transparent to-[#0A0A0A] z-10 pointer-events-none" />

        {/* Floating Weather Control Bar (Desktop) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2.5 w-[90%] max-w-[380px]">
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-[11px] text-white/70">
            <span className="text-white/40 uppercase tracking-wider text-[10px] font-semibold">Clima:</span>
            <span className="text-emerald-400 font-semibold tracking-wide">
              {manualWeather
                ? WEATHER_OPTIONS.find((o) => o.file === manualWeather)?.name || "Personalizado"
                : "Automático (Ao vivo)"}
            </span>
          </div>

          <div className="flex items-center justify-between w-full p-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl">
            {WEATHER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = opt.id === "auto" ? manualWeather === null : manualWeather === opt.file;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectWeather(opt)}
                  title={opt.name}
                  className={`relative flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium transition-all duration-300 ${
                    isSelected
                      ? "bg-white/20 text-white border border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.25)] scale-105"
                      : "text-white/60 hover:text-white hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <Icon size={16} className={isSelected ? "text-emerald-400" : ""} />
                  <span className="hidden xl:inline text-[11px] font-semibold">{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
  
      {/* Right Side: Form Panel (60%) */}
      <div className="w-full lg:w-[60%] relative flex flex-col justify-center items-center p-8 sm:p-12 z-20 bg-[#0A0A0A]">
        
        {/* Background Particles inside the form panel */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-50">
          <Particles />
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-[#ffffff] tracking-wide mb-1 drop-shadow-md">
              Olá!
            </h1>
            <h2 className="text-xl font-medium text-[#cccccc] tracking-wide drop-shadow-md">
              Bem-vindo de volta
            </h2>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {errorMsg && (
              <div className="bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#fca5a5] text-sm p-3 rounded-lg text-center">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="relative group">
                <style dangerouslySetInnerHTML={{__html: `
                  input:-webkit-autofill,
                  input:-webkit-autofill:hover, 
                  input:-webkit-autofill:focus, 
                  input:-webkit-autofill:active{
                      -webkit-box-shadow: 0 0 0 30px #1A1D24 inset !important;
                      -webkit-text-fill-color: white !important;
                  }
                `}} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  className="w-full px-5 py-4 rounded-xl bg-[#1A1D24] border border-[#ffffff]/10 text-[#ffffff] text-sm font-medium outline-none placeholder:text-[#888888] focus:bg-[#20242D] focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all shadow-inner"
                />
                <Mail size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#888888] group-focus-within:text-[#10b981] transition-colors" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full px-5 py-4 rounded-xl bg-[#1A1D24] border border-[#ffffff]/10 text-[#ffffff] text-sm font-medium outline-none placeholder:text-[#888888] focus:bg-[#20242D] focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#ffffff] group-focus-within:text-[#10b981] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-full py-4 mt-2 text-sm font-bold text-[#0A0A0A] bg-[#ffffff] rounded-xl disabled:opacity-50 transition-all hover:bg-[#e2e8f0] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Mobile Weather Selector */}
          <div className="mt-8 flex flex-col items-center gap-2 lg:hidden z-20">
            <span className="text-[11px] text-slate-400 font-medium">Clima de Fundo</span>
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#1A1D24] border border-white/10">
              {WEATHER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = opt.id === "auto" ? manualWeather === null : manualWeather === opt.file;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectWeather(opt)}
                    title={opt.name}
                    className={`p-2 rounded-lg text-xs transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
