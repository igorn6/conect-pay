const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "src/components/settings");

const content = `"use client";

import { useState, useEffect } from "react";
import { Camera, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function SettingsProfile() {
  const { userName } = useAuth();
  const [userEmail, setUserEmail] = useState("");
  
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAvatarClick = () => {
    showToast("O upload de arquivos via Storage estar\u00e1 dispon\u00edvel na pr\u00f3xima vers\u00e3o.", "error");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 6) {
      showToast("A nova senha deve ter no m\u00ednimo 6 caracteres.", "error");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      showToast("A nova senha e a confirma\u00e7\u00e3o n\u00e3o coincidem.", "error");
      return;
    }

    setIsSubmitting(true);

    // Reautentica\u00e7\u00e3o rigorosa
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: senhaAtual,
    });

    if (signInError) {
      showToast("Senha atual incorreta. Acesso negado.", "error");
      setIsSubmitting(false);
      return;
    }

    // Atualiza\u00e7\u00e3o efetiva
    const { error: updateError } = await supabase.auth.updateUser({
      password: novaSenha
    });

    setIsSubmitting(false);

    if (updateError) {
      showToast("Erro ao atualizar senha: " + updateError.message, "error");
    } else {
      showToast("Senha atualizada com sucesso!", "success");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    }
  };

  const displayNome = userName || "Usu\u00e1rio Conect Pay";
  const avatarUrl = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(displayNome)}&background=334155&color=fff&size=128\`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl space-y-8">
      
      {/* Dados e Avatar */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Meu Perfil</h1>
          <p className="text-slate-400 text-sm">Gerencie suas informa\u00e7\u00f5es pessoais e seguran\u00e7a.</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <img 
              src={avatarUrl} 
              alt="Avatar do Usu\u00e1rio" 
              className="w-24 h-24 rounded-full border-4 border-slate-700 object-cover"
            />
            <button 
              onClick={handleAvatarClick}
              className="flex items-center gap-2 px-4 py-2 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Camera size={16} />
              Alterar Foto
            </button>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome Completo</label>
              <div className="mt-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200">
                {displayNome}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">E-mail</label>
              <div className="mt-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200">
                {userEmail || "Carregando..."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seguran\u00e7a e Senha */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Seguran\u00e7a</h2>
        <form onSubmit={handleChangePassword} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-slate-200 font-medium">Altera\u00e7\u00e3o de Senha</h3>
              <p className="text-xs text-slate-400">Preencha os dados abaixo para atualizar sua senha de acesso.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">Senha Atual</label>
            <input
              type="password"
              required
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !senhaAtual || !novaSenha || !confirmarSenha}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                "Atualizar Senha"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Toast flutuante */}
      {toast && (
        <div className={\`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 text-white \${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}\`}>
          {toast.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(path.join(dir, "SettingsProfile.tsx"), content, "utf-8");
console.log("Created SettingsProfile.tsx");
