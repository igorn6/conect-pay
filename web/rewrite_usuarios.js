const fs = require("fs");
const path = require("path");
const userPagePath = path.join(__dirname, "src/app/(main)/usuarios/page.tsx");

const content = `"use client";

import { useState, useEffect } from "react";
import { UserPlus, Shield, ShieldCheck, Mail, Loader2, X, Trash2, AlertTriangle, Briefcase, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile } from "@/types/database";

type CombinedUser = Profile & { email?: string; is_active?: boolean };

export default function UsuariosPage() {
  const { userRole, userId: currentUserId } = useAuth();
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("GESTOR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Delete State
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  useEffect(() => {
    if (userRole === "MASTER") {
      fetchUsers();
    }
  }, [userRole]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erro ao buscar usu\u00e1rios.");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, role: formRole })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usu\u00e1rio.");
      
      showToast("Usu\u00e1rio criado com sucesso!", "success");
      setIsCreateModalOpen(false);
      setFormName("");
      setFormEmail("");
      setFormRole("GESTOR");
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!userToDelete) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userToDelete })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao inativar usu\u00e1rio.");
      
      showToast("Usu\u00e1rio inativado com sucesso!", "success");
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // RBAC GUARD
  if (userRole !== "MASTER") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-slate-950 text-slate-400">
        <Shield size={64} className="mb-4 text-red-500/50" />
        <h1 className="text-2xl font-bold text-slate-200">Acesso Negado</h1>
        <p className="mt-2 text-sm">Esta p\u00e1gina \u00e9 restrita a administradores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-950 min-h-[calc(100vh-4rem)] text-slate-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Gest\u00e3o de Usu\u00e1rios</h1>
            <p className="text-slate-400 text-sm mt-1">Gerencie acessos e permiss\u00f5es do sistema.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            <UserPlus size={18} />
            Novo Usu\u00e1rio
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Funcion\u00e1rio</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Cargo / Acesso</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 text-right">A\u00e7\u00f5es</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex justify-center"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Nenhum usu\u00e1rio encontrado.</td>
                  </tr>
                ) : (
                  users.map(user => {
                    const isActive = user.is_active !== false;
                    return (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={\`https://ui-avatars.com/api/?name=\${encodeURIComponent(user.name)}&background=334155&color=fff&size=64\`} 
                              alt={user.name} 
                              className={\`w-10 h-10 rounded-full border-2 border-slate-700 \${!isActive && "opacity-50 grayscale"}\`}
                            />
                            <div>
                              <p className={\`text-sm font-semibold \${!isActive ? "text-slate-500" : "text-slate-200"}\`}>{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {user.role === "MASTER" && <ShieldCheck size={16} className="text-emerald-500" />}
                            {user.role === "FINANCEIRO" && <Briefcase size={16} className="text-blue-500" />}
                            {user.role === "GESTOR" && <UserPlus size={16} className="text-purple-500" />}
                            <span className={\`text-sm font-medium \${!isActive ? "text-slate-500" : "text-slate-300"}\`}>{user.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500 border border-slate-700"}\`}>
                            {isActive ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {user.id !== currentUserId && isActive && (
                            <button
                              onClick={() => {
                                setUserToDelete(user.id);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Inativar Usu\u00e1rio"
                            >
                              <Lock size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Criar */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Novo Usu\u00e1rio</h2>
                <p className="text-sm text-slate-400">Adicione um membro ao sistema.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder="Ex: Jo\u00e3o Silva"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">E-mail Corporativo</label>
                <div className="relative mt-1.5">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                    placeholder="joao@empresa.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">N\u00edvel de Acesso</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="GESTOR">Gestor</option>
                  <option value="FINANCEIRO">Financeiro</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-3 mt-4 border border-slate-700/50">
                <Shield size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  A senha padr\u00e3o para novos acessos ser\u00e1: <strong className="text-emerald-400">Conectsol123</strong>. O usu\u00e1rio ser\u00e1 obrigado a troc\u00e1-la no primeiro login.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Criar Usu\u00e1rio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inativar */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden slide-in-from-bottom-4">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Bloquear Acesso?</h2>
              <p className="text-sm text-slate-400 mb-6">
                Tem certeza? O acesso deste usu\u00e1rio ser\u00e1 bloqueado imediatamente, mas seu hist\u00f3rico de a\u00e7\u00f5es ser\u00e1 mantido no sistema.
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSoftDelete} disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Sim, bloquear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={\`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 text-white z-50 \${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}\`}>
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(userPagePath, content, "utf-8");
console.log("Rewrote usuarios/page.tsx");
