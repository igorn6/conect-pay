"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/database";
import { Loader2, KeyRound } from "lucide-react";

interface AuthContextType {
  userRole: UserRole | null;
  userName: string | null;
  userId: string | null;
  sectorId: string | null;
  sectorName: string | null;
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  setUserName: (name: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for password reset
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function loadUser(session: any) {
      if (!session?.user) {
        if (mounted) {
          setUserId(null);
          setSectorId(null);
          setSectorName(null);
          setUserName(null);
          setUserRole(null);
          setMustChangePassword(false);
          setIsLoading(false);
          
        }
        return;
      }

      const id = session.user.id;
      
      let data: any = null;
      let error: any = null;

      try {
        const headers: Record<string, string> = {
          "x-user-id": id,
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
        const meRes = await fetch(`/api/auth/me?userId=${id}`, { cache: "no-store", headers });
        if (meRes.ok) {
          data = await meRes.json();
        }
      } catch (e) {
        console.warn("Fallback to client query:", e);
      }

      if (!data) {
        try {
          const usersRes = await fetch("/api/admin/users", { cache: "no-store" });
          if (usersRes.ok) {
            const allUsers = await usersRes.json();
            const found = allUsers.find((u: any) => u.id === id);
            if (found) {
              data = found;
            }
          }
        } catch (e) {
          console.warn("Fallback to admin users query:", e);
        }
      }

      if (!data) {
        const direct = await supabase
          .from("profiles")
          .select("name, role, sector, must_change_password, avatar_url")
          .eq("id", id)
          .single();
        data = direct.data;
        error = direct.error;
      }

      if (mounted) {
        if (!error && data) {
          setUserId(id);
          setSectorId(data.sector);
          setSectorName(data.sector_name || data.sector || null);
          setAvatarUrl(data.avatar_url);
          setUserName(data.name);
          setMustChangePassword(!!data.must_change_password);
          
          const userEmail = (session?.user?.email || "").toLowerCase();
          let dbRole = (data.role || "").trim().toUpperCase();
          if (userEmail === "igornaraujo6@gmail.com") {
            dbRole = "MASTER";
          }
          if (dbRole === "MASTER") {
            setUserRole("MASTER");
          } else if (dbRole === "FINANCEIRO") {
            setUserRole("FINANCEIRO");
          } else {
            setUserRole("GESTOR");
          }
        } else {
          setUserId(id);
          setUserName(session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Usuário");
            if ((session.user.email || "").toLowerCase() === "igornaraujo6@gmail.com") {
              setUserRole("MASTER");
            } else {
              setUserRole("GESTOR");
            }
          }
          setIsLoading(false);
        
        
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session);
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        setTimeout(() => {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }, 50);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        setTimeout(() => {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }, 50);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setResetError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword === "Conectsol123") {
      setResetError("Você não pode usar a senha padrão.");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      if (!userId) {
        throw new Error("Sessão não identificada. Por favor, recarregue a página.");
      }

      // 1. Tenta atualizar via rota de administração de senha
      let res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          newPassword,
          mustChangePassword: false,
        }),
      });

      // Se falhar ou não encontrar, tenta a rota de usuário direta
      if (!res.ok) {
        res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword, mustChangePassword: false }),
        });
      }

      let data: any = {};
      try {
        const text = await res.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch {
        // Fallback se não for JSON válido
      }

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao alterar senha. Tente novamente.");
      }

      // 2. Atualiza a senha no cliente Supabase Auth se houver sessão ativa
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (authErr) {
        console.warn("Aviso ao atualizar sessão local:", authErr);
      }
      
      // 3. Libera o acesso imediato
      setMustChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setResetError(err.message || "Erro inesperado ao alterar senha.");
    } finally {
      setResetLoading(false);
    }
  };

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>;
  }

  // Force Password Reset Screen Overlay
  if (mustChangePassword && pathname !== "/login") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center text-emerald-500 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-full">
              <KeyRound size={32} />
            </div>
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-white">
            Atualize sua senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Por motivos de segurança, você precisa alterar a senha padrão antes de acessar o sistema.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-gray-900 py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-800">
            <form className="space-y-6" onSubmit={handleForcePasswordChange}>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Nova Senha
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-700 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-gray-950 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Confirmar Nova Senha
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-700 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-gray-950 text-white"
                  />
                </div>
              </div>

              {resetError && (
                <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? <Loader2 size={16} className="animate-spin" /> : "Salvar Nova Senha"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ userRole, userName, setUserName, userId, sectorId, sectorName, avatarUrl, setAvatarUrl, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
