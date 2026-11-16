"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  Sunset,
  Cloud,
  CloudRain,
  CloudLightning,
  MapPin,
  LocateFixed,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandLogo from "@/components/BrandLogo";
import { APP_VERSION } from "@/constants/version";
import { getClockFallbackWeather, type WeatherVisualCondition } from "@/lib/weather";

interface WeatherInfo {
  city: string | null;
  region: string | null;
  temperature: number | null;
  condition: WeatherVisualCondition;
  label: string;
  bgImage: string;
  locationSource?: "gps" | "vercel" | "ip" | "clock";
}

function WeatherConditionIcon({
  condition,
  size = 16,
}: {
  condition: WeatherVisualCondition;
  size?: number;
}) {
  switch (condition) {
    case "STORM":
      return <CloudLightning size={size} className="text-amber-300 shrink-0" />;
    case "RAIN":
      return <CloudRain size={size} className="text-sky-300 shrink-0" />;
    case "CLOUDY":
      return <Cloud size={size} className="text-slate-200 shrink-0" />;
    case "NIGHT":
      return <Moon size={size} className="text-indigo-200 shrink-0" />;
    case "SUNSET":
      return <Sunset size={size} className="text-orange-300 shrink-0" />;
    default:
      return <Sun size={size} className="text-amber-300 shrink-0" />;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [bgImage, setBgImage] = useState("/weather/sunny.jpg");
  const [bgReady, setBgReady] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);

  const preloadAndSetBg = useCallback((imageUrl: string) => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setBgImage(imageUrl);
      setBgReady(true);
    };
    img.onerror = () => setBgReady(true);
  }, []);

  const loadWeather = useCallback(
    async (coords?: { lat: number; lon: number }) => {
      const hour = new Date().getHours();
      try {
        const params = new URLSearchParams({ hour: String(hour) });
        if (coords) {
          params.set("lat", String(coords.lat));
          params.set("lon", String(coords.lon));
        }
        const res = await fetch(`/api/weather?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: WeatherInfo = await res.json();
        setWeather(data);
        if (data?.bgImage) {
          preloadAndSetBg(data.bgImage);
        }
      } catch {
        // Mantém fallback de horário
      }
    },
    [preloadAndSetBg]
  );

  // Inicializa com fallback imediato pelo horário e busca clima real da cidade do usuário
  useEffect(() => {
    let active = true;
    const fb = getClockFallbackWeather(new Date().getHours());
    preloadAndSetBg(fb.bgImage);

    // Se permissão de GPS já foi concedida antes, usa coordenadas precisas sem exibir popup
    const init = async () => {
      if (typeof navigator !== "undefined" && navigator.permissions && navigator.geolocation) {
        try {
          const status = await navigator.permissions.query({ name: "geolocation" });
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (active) {
                  loadWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                }
              },
              () => {
                if (active) loadWeather();
              },
              { timeout: 3000, maximumAge: 300000 }
            );
            return;
          }
        } catch {
          // Segue para geolocalização automática via servidor/IP
        }
      }
      if (active) loadWeather();
    };

    init();
    return () => {
      active = false;
    };
  }, [loadWeather, preloadAndSetBg]);

  const handleUsePreciseLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation || locatingGps) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await loadWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
      },
      { timeout: 6000, maximumAge: 60000 }
    );
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
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 24;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 24;
    setMousePos({ x, y });
  };

  return (
    <div className="min-h-screen w-full flex bg-[#080b12] text-[#f8fafc] overflow-hidden font-sans select-none">
      
      {/* Left Side: Ambient Parallax Imagery (42%) */}
      <div 
        className="hidden lg:block w-[42%] relative overflow-hidden bg-[#05070c]"
        onMouseMove={handleMouseMove}
      >
        {/* Mouse Parallax Wrapper */}
        <div 
          className="absolute inset-0 w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: `translate(${-mousePos.x}px, ${-mousePos.y}px) scale(1.06)` }}
        >
          <div 
            className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out ${bgReady ? "opacity-90" : "opacity-0"}`}
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/80 via-transparent to-[#080b12]/30 pointer-events-none" />
        </div>

        {/* Gradient edge blending to form panel */}
        <div className="absolute inset-y-0 right-0 w-36 bg-gradient-to-r from-transparent to-[#080b12] z-10 pointer-events-none" />

        {/* Live Local Weather Pill */}
        {weather && (
          <div className="absolute top-7 left-8 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#080b12]/65 border border-white/15 backdrop-blur-md shadow-xl">
            <WeatherConditionIcon condition={weather.condition} size={18} />
            <div className="flex items-center gap-2 text-xs">
              {weather.temperature !== null && (
                <span className="font-mono font-bold tabular-nums text-white text-sm">
                  {weather.temperature}°C
                </span>
              )}
              <span className="text-slate-200 font-medium">{weather.label}</span>
              {weather.city && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                    <MapPin size={11} className="text-emerald-400 shrink-0" />
                    <span>
                      {weather.city}
                      {weather.region ? `, ${weather.region}` : ""}
                    </span>
                  </span>
                </>
              )}
            </div>
            {weather.locationSource !== "gps" && (
              <button
                type="button"
                onClick={handleUsePreciseLocation}
                disabled={locatingGps}
                title="Atualizar com localização exata (GPS do navegador)"
                aria-label="Usar localização exata"
                className="ml-0.5 p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <LocateFixed
                  size={13}
                  className={locatingGps ? "animate-spin text-emerald-400" : ""}
                />
              </button>
            )}
          </div>
        )}

        {/* Subtle branding watermark on bottom left */}
        <div className="absolute bottom-8 left-8 z-20 pointer-events-none">
          <div className="text-xs uppercase tracking-widest font-mono text-white/50">
            Conect Pay • Gestão Financeira Inteligente
          </div>
        </div>
      </div>
  
      {/* Right Side: Form Panel (58%) */}
      <div className="w-full lg:w-[58%] relative flex flex-col justify-center items-center p-6 sm:p-12 z-20 bg-[#080b12]">
        
        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          
          {/* Header Card */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-6 group select-none">
              <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center justify-center px-5 py-3.5 rounded-2xl bg-[#0f1422] border border-[#253046] shadow-xl hover:border-[#384869] transition-all">
                <BrandLogo size="2xl" forceTheme="dark" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#f8fafc] tracking-tight mb-1.5">
              Acesso ao Sistema
            </h1>
            <p className="text-sm font-medium text-[#94a3b8]">
              Entre com suas credenciais corporativas
            </p>

            {/* Compact mobile weather pill */}
            {weather && (
              <div className="mt-3 lg:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0f1422] border border-[#253046] text-xs text-slate-300">
                <WeatherConditionIcon condition={weather.condition} size={14} />
                {weather.temperature !== null && (
                  <span className="font-mono font-bold tabular-nums text-white">
                    {weather.temperature}°C
                  </span>
                )}
                <span>{weather.label}</span>
                {weather.city && (
                  <>
                    <span className="text-white/25">•</span>
                    <span className="text-slate-400">
                      {weather.city}
                      {weather.region ? `, ${weather.region}` : ""}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Form Card */}
          <div className="rounded-2xl bg-[#0f1422]/90 border border-[#253046] p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              
              {/* Error Alert */}
              {errorMsg && (
                <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm p-3.5 rounded-xl font-medium">
                  <AlertCircle size={18} className="text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#cbd5e1] font-mono">
                  E-mail
                </label>
                <div className="relative group">
                  <style dangerouslySetInnerHTML={{__html: `
                    input:-webkit-autofill,
                    input:-webkit-autofill:hover, 
                    input:-webkit-autofill:focus, 
                    input:-webkit-autofill:active{
                        -webkit-box-shadow: 0 0 0 30px #151b2c inset !important;
                        -webkit-text-fill-color: #f8fafc !important;
                    }
                  `}} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@conectsol.com"
                    className="w-full pl-4 pr-11 py-3.5 rounded-xl bg-[#151b2c] border border-[#283452] text-[#f8fafc] text-sm font-medium outline-none placeholder:text-[#64748b] hover:border-[#384869] focus:bg-[#182138] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                  />
                  <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#cbd5e1] font-mono">
                  Senha
                </label>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-4 pr-11 py-3.5 rounded-xl bg-[#151b2c] border border-[#283452] text-[#f8fafc] text-sm font-medium outline-none placeholder:text-[#64748b] hover:border-[#384869] focus:bg-[#182138] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#f8fafc] group-focus-within:text-emerald-400 transition-colors"
                    title={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3.5 mt-2 text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 rounded-xl disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Conect Pay</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center text-xs text-[#64748b] font-mono">
            Conect Pay v{APP_VERSION} • Ambiente Seguro e Criptografado
          </div>
        </div>
      </div>
    </div>
  );
}
