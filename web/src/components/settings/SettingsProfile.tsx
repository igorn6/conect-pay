"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Lock, CheckCircle2, AlertCircle, Loader2, User, Save, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function SettingsProfile() {
  const { userName, setUserName, userId, avatarUrl: authAvatarUrl, setAvatarUrl, userRole, sectorId, sectorName: authSectorName } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userEmail, setUserEmail] = useState("");
  const [sectorName, setSectorName] = useState<string | null>(authSectorName || null);
  
  // Nome
  const [nome, setNome] = useState(userName || "");
  const [isUpdatingNome, setIsUpdatingNome] = useState(false);
  
  // Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  useEffect(() => {
    if (userName) {
      setNome(userName);
    }
  }, [userName]);

  useEffect(() => {
    if (authSectorName) {
      setSectorName(authSectorName);
    }
  }, [authSectorName]);

  useEffect(() => {
    async function loadSectorFallback() {
      if (sectorName) return;
      try {
        const res = await fetch(`/api/auth/me${userId ? `?userId=${userId}` : ""}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.sector_name) {
            setSectorName(data.sector_name);
            return;
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar setor do usuário:", e);
      }

      if (sectorId) {
        try {
          const { data: sec } = await supabase
            .from("sectors")
            .select("name")
            .eq("id", sectorId)
            .maybeSingle();
          if (sec?.name) {
            setSectorName(sec.name);
          }
        } catch (e) {
          console.warn("Erro ao buscar nome do setor:", e);
        }
      }
    }

    loadSectorFallback();
  }, [sectorName, sectorId, userId]);

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
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("O arquivo deve ter não máximo 2MB.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      showToast("Foto de perfil atualizada com sucesso!", "success");
    } catch (err: any) {
      showToast("Erro ao fazer upload da foto: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveNome = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim();
    if (!cleanNome) {
      showToast("O nome não pode ficar vazio.", "error");
      return;
    }

    setIsUpdatingNome(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // 1. Chamada para a API interna que usa o service role e atualiza banco + metadados
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: cleanNome })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Erro ao salvar nome não servidor");
      }

      // 2. Atualizar não Auth client do Supabase também para persistir não token local
      await supabase.auth.updateUser({
        data: { name: cleanNome, full_name: cleanNome }
      });

      // 3. Atualizar não estado global do AuthContext e não estado local
      setUserName(cleanNome);
      setNome(cleanNome);
      showToast("Nome atualizado com sucesso!", "success");
    } catch (err: any) {
      showToast("Erro ao atualizar nome: " + err.message, "error");
    } finally {
      setIsUpdatingNome(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 6) {
      showToast("A nova senha deve ter não mínimo 6 caracteres.", "error");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      showToast("A nova senha e a confirmação não coincidem.", "error");
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: senhaAtual,
    });

    if (signInError) {
      showToast("Senha atual incorreta. Acesso negado.", "error");
      setIsSubmitting(false);
      return;
    }

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

  const displayNome = nome || userName || "Usuário Conect Pay";
  const avatarUrl = authAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNome)}&background=334155&color=fff&size=128`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl space-y-8">
      
      {/* Dados e Avatar */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Meu Perfil</h1>
          <p className="text-slate-400 text-sm">Gerencie suas informações pessoais e segurança.</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <img 
              src={avatarUrl} 
              alt="Avatar do Usuário" 
              className="w-24 h-24 rounded-full border-4 border-slate-700 object-cover"
            />
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <button 
              onClick={handleAvatarClick}
              className="flex items-center gap-2 px-4 py-2 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Camera size={16} />
              Alterar Foto
            </button>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <form onSubmit={handleSaveNome} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                {nome.trim() !== (userName || "") && (
                  <span className="text-xs text-amber-400 font-medium">Alteração pendente</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-emerald-500 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={isUpdatingNome || !nome.trim() || nome.trim() === (userName || "")}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {isUpdatingNome ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </form>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">E-mail</label>
              <div className="mt-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 text-sm">
                {userEmail || "Carregando..."}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Perfil de Acesso</label>
                <div className="mt-1.5 px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/70 rounded-lg text-slate-200 text-xs font-semibold tracking-wide uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">
                    {userRole === "MASTER" ? "Master (Administrador Total)" : (userRole === "FINANCEIRO" ? "Financeiro" : "Gestor")}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Setor Vinculado</label>
                <div className="mt-1.5 px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/70 rounded-lg text-slate-200 text-xs font-medium flex items-center gap-2">
                  <Briefcase size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate font-medium">
                    {userRole === "MASTER"
                      ? "Acesso Global (Todos os Setores)"
                      : (sectorName || (sectorId ? "Carregando..." : "Nenhum setor vinculado"))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segurança e Senha */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Segurança</h2>
        <form onSubmit={handleChangePassword} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-slate-200 font-medium">Alteração de Senha</h3>
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
              placeholder="••••••"
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
                placeholder="••••••"
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
                placeholder="••••••"
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
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 text-white ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
