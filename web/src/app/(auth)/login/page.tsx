"use client";

import { useState, useEffect } from "react";
import { Mail, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Particles from "@/components/Particles";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [bgImage, setBgImage] = useState("/weather/sunny.jpg");
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
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
    }

    fetchWeather();
  }, []);

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
        </div>
      </div>
    </div>
  );
}
