"use client";

import { useState, useEffect } from "react";
import { Mail, Eye, EyeOff, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandLogo from "@/components/BrandLogo";
import { APP_VERSION } from "@/constants/version";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [bgImage, setBgImage] = useState("/weather/sunny.jpg");
  const [bgReady, setBgReady] = useState(false);

  // Fundo estático escolhido pelo horário local
  useEffect(() => {
    const h = new Date().getHours();
    const image = h >= 19 || h < 6 ? "/weather/night.jpg" : h >= 17 ? "/weather/sunset.jpg" : "/weather/sunny.jpg";
    const img = new Image();
    img.src = image;
    img.onload = () => {
      setBgImage(image);
      setBgReady(true);
    };
    img.onerror = () => setBgReady(true);
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
