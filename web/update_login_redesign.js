const fs = require('fs');
const path = require('path');

// 1. Update Login Page
const pageFile = path.join(process.cwd(), "src/app/(auth)/login/page.tsx");
const pageCode = `"use client";

import { useState } from "react";
import { LogIn, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A]">
      <div className="w-full max-w-[900px] h-[550px] bg-[#111318] rounded-3xl overflow-hidden flex shadow-2xl relative border border-slate-800/50">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-[45%] p-10 flex flex-col justify-center relative z-10 bg-[#111318]">
          
          <div className="mb-10 text-center flex flex-col items-center">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-2">
              Faça seu login<span className="text-emerald-500">.</span>
            </h1>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#1C1F26] border-none text-white text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#1C1F26] border-none text-white text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="flex justify-end mt-1">
                <a href="#" className="text-xs text-gray-500 hover:text-emerald-400 transition-colors underline-offset-2 hover:underline">
                  Esqueci minha Senha
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 mt-4 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/20"
              style={{
                background: "linear-gradient(135deg, #10b981, #06b6d4)",
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <a href="#" className="text-xs text-gray-500 hover:text-white transition-colors underline-offset-2 hover:underline">
              Ainda não tem uma conta?
            </a>
          </div>
        </div>
        
        {/* Right Side: Animated Image */}
        <div className="hidden md:block flex-1 relative overflow-hidden bg-black">
          {/* Gradient Fade to connect the sections seamlessly */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#111318] via-[#111318]/80 to-transparent z-10 pointer-events-none" />
          
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center animate-slow-pan opacity-90"
            style={{ backgroundImage: 'url(/solar-park-bg.jpg)' }}
          />
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(pageFile, pageCode);
console.log("Updated Login Page");

// 2. Update globals.css with animation
const cssFile = path.join(process.cwd(), "src/app/globals.css");
let cssCode = fs.readFileSync(cssFile, 'utf8');

if (!cssCode.includes('slow-pan')) {
  cssCode += `
@keyframes slow-pan {
  0%, 100% { transform: scale(1.05) translate(0, 0); }
  50% { transform: scale(1.1) translate(-2%, 2%); }
}

.animate-slow-pan {
  animation: slow-pan 30s ease-in-out infinite alternate;
}
`;
  fs.writeFileSync(cssFile, cssCode);
  console.log("Updated globals.css");
}
