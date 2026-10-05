"use client";

import { useState, useEffect } from "react";
import { 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Mail, 
  Loader2, 
  X, 
  AlertTriangle, 
  Briefcase, 
  Lock, 
  ChevronUp, 
  ChevronDown, 
  KeyRound, 
  Pencil, 
  Eye, 
  EyeOff, 
  Sparkles 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

type CombinedUser = Profile & { email?: string; is_active?: boolean };

export default function SettingsUsers() {
  const { userRole, userId: currentUserId } = useAuth();
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  const [userToEdit, setUserToEdit] = useState<CombinedUser | null>(null);
  const [userForPassword, setUserForPassword] = useState<CombinedUser | null>(null);
  
  // Form State (Create / Edit)
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("GESTOR");
  const [formSector, setFormSector] = useState<string>("");
  const [formEditPassword, setFormEditPassword] = useState("");
  const [sectors, setSectors] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Password Modal State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Delete State
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'role' | 'sector' | 'status'; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: 'name' | 'role' | 'sector' | 'status') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSectorName = (id: string) => sectors.find(s => s.id === id)?.name || "Sem Setor";

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let valA = "";
    let valB = "";
    
    if (sortConfig.key === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortConfig.key === 'role') {
      valA = a.role.toLowerCase();
      valB = b.role.toLowerCase();
    } else if (sortConfig.key === 'sector') {
      valA = getSectorName(a.sector || "").toLowerCase();
      valB = getSectorName(b.sector || "").toLowerCase();
    } else if (sortConfig.key === 'status') {
      valA = a.is_active !== false ? "ativo" : "inativo";
      valB = b.is_active !== false ? "ativo" : "inativo";
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Toast
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  const fetchSectors = async () => {
    const { data } = await supabase.from("sectors").select("*").eq("is_deleted", false).order("name");
    if (data) {
      setSectors(data);
      if (data.length > 0) setFormSector(data[0].id);
    }
  };

  useEffect(() => {
    if (userRole === "MASTER") {
      fetchUsers();
      fetchSectors();
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
      if (!res.ok) throw new Error("Erro ao buscar usuários.");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: CombinedUser) => {
    setUserToEdit(user);
    setFormName(user.name);
    setFormEmail(user.email || "");
    setFormRole(user.role);
    setFormSector(user.sector || "");
    setFormEditPassword("");
    setIsEditModalOpen(true);
  };

  const handleOpenPasswordModal = (user: CombinedUser) => {
    setUserForPassword(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setMustChangeOnLogin(false);
    setPasswordError("");
    setIsPasswordModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setPasswordError("");
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setIsSubmitting(true);
    
    try {
      const payload: any = {
        id: userToEdit.id,
        name: formName,
        role: formRole,
        sector: formSector || null,
      };

      if (userRole === "MASTER" && formEmail.trim() && formEmail.trim().toLowerCase() !== (userToEdit.email || "").toLowerCase()) {
        payload.email = formEmail.trim();
      }

      if (formEditPassword.trim()) {
        if (formEditPassword.trim().length < 6) {
          throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
        }
        payload.password = formEditPassword.trim();
      }

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário.");
      
      showToast(
        formEditPassword.trim() 
          ? "Usuário e senha atualizados com sucesso!" 
          : "Usuário atualizado com sucesso!", 
        "success"
      );
      setIsEditModalOpen(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForPassword) return;

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    setIsSubmittingPassword(true);
    setPasswordError("");

    try {
      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userForPassword.id,
          newPassword: newPassword,
          mustChangePassword: mustChangeOnLogin,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar senha.");

      showToast(`Senha de ${userForPassword.name} alterada com sucesso!`, "success");
      setIsPasswordModalOpen(false);
      setUserForPassword(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Erro ao alterar senha.");
      showToast(err.message, "error");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, role: formRole, sector: formSector || null })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário.");
      
      showToast("Usuário criado com sucesso!", "success");
      setIsCreateModalOpen(false);
      setFormName("");
      setFormEmail("");
      setFormRole("GESTOR");
      if (sectors.length > 0) setFormSector(sectors[0].id);
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
      if (!res.ok) throw new Error(data.error || "Erro ao inativar usuário.");
      
      showToast("Usuário inativado com sucesso!", "success");
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
        <p className="mt-2 text-sm">Esta página é restrita a administradores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-950 min-h-[calc(100vh-4rem)] text-slate-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Gestão de Usuários</h1>
            <p className="text-slate-400 text-sm mt-1">Gerencie acessos, senhas e permissões do sistema.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/10"
          >
            <UserPlus size={18} />
            Novo Usuário
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50">
                  <th onClick={() => handleSort('name')} className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 cursor-pointer hover:text-slate-200 transition-colors">
                    <div className="flex items-center gap-1">
                      Funcionário
                      {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('role')} className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 cursor-pointer hover:text-slate-200 transition-colors">
                    <div className="flex items-center gap-1">
                      Cargo / Acesso
                      {sortConfig?.key === 'role' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('sector')} className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 cursor-pointer hover:text-slate-200 transition-colors">
                    <div className="flex items-center gap-1">
                      Setor
                      {sortConfig?.key === 'sector' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('status')} className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 cursor-pointer hover:text-slate-200 transition-colors">
                    <div className="flex items-center gap-1">
                      Status
                      {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex justify-center"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  sortedUsers.map(user => {
                    const isActive = user.is_active !== false;
                    return (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(user)}>
                          <div className="flex items-center gap-3">
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=334155&color=fff&size=64`} 
                              alt={user.name} 
                              className={`w-10 h-10 rounded-full border-2 border-slate-700 ${!isActive && "opacity-50 grayscale"}`}
                            />
                            <div>
                              <p className={`text-sm font-semibold ${!isActive ? "text-slate-500" : "text-slate-200"}`}>{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(user)}>
                          <div className="flex items-center gap-2">
                            {user.role === "MASTER" && <ShieldCheck size={16} className="text-emerald-500" />}
                            {user.role === "FINANCEIRO" && <Briefcase size={16} className="text-blue-500" />}
                            {user.role === "GESTOR" && <UserPlus size={16} className="text-purple-500" />}
                            <span className={`text-sm font-medium ${!isActive ? "text-slate-500" : "text-slate-300"}`}>{user.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(user)}>
                          <span className="text-sm text-slate-300">{getSectorName(user.sector || "")}</span>
                        </td>
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(user)}>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            isActive 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {isActive ? "Ativo" : "Bloqueado"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Alterar Senha */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPasswordModal(user);
                              }}
                              className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors"
                              title="Alterar Senha do Usuário"
                            >
                              <KeyRound size={17} />
                            </button>

                            {/* Botão Editar Usuário */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(user);
                              }}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar Usuário"
                            >
                              <Pencil size={17} />
                            </button>

                            {/* Botão Inativar Usuário */}
                            {user.id !== currentUserId && isActive && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserToDelete(user.id);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Bloquear Acesso"
                              >
                                <Lock size={17} />
                              </button>
                            )}
                          </div>
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

      {/* Modal Alterar Senha (DEDICADO) */}
      {isPasswordModalOpen && userForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Alterar Senha</h2>
                  <p className="text-xs text-slate-400 truncate max-w-[240px]">
                    Usuário: <span className="text-slate-200 font-medium">{userForPassword.name}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPasswordModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Ações rápidas de senha */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs text-slate-400">Atalhos rápidos:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword("Conectsol123");
                      setConfirmPassword("Conectsol123");
                      setShowNewPassword(true);
                      setShowConfirmPassword(true);
                      setPasswordError("");
                    }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    Conectsol123
                  </button>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    Gerar Aleatória
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Nova Senha</label>
                <div className="relative mt-1.5">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite no mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-all pr-11 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Confirmar Nova Senha</label>
                <div className="relative mt-1.5">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-all pr-11 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={mustChangeOnLogin}
                    onChange={(e) => setMustChangeOnLogin(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500/50"
                  />
                  <span>Exigir que o usuário redefina a senha no próximo login</span>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 flex justify-center items-center gap-2 transition-all font-semibold shadow-lg shadow-amber-400/20"
                >
                  {isSubmittingPassword ? <Loader2 size={16} className="animate-spin" /> : "Salvar Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Novo Usuário</h2>
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
                  placeholder="Ex: João Silva"
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
                <label className="text-sm font-medium text-slate-300">Nível de Acesso</label>
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
              
              <div>
                <label className="text-sm font-medium text-slate-300">Setor</label>
                <select
                  required
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-3 mt-4 border border-slate-700/50">
                <Shield size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  A senha padrão para novos acessos será: <strong className="text-emerald-400">Conectsol123</strong>. O usuário poderá alterá-la depois.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Editar Usuário</h2>
                <p className="text-sm text-slate-400">Altere os dados de {userToEdit.name}.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-300">E-mail</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-300">Perfil de Acesso</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500 appearance-none"
                >
                  <option value="GESTOR">Gestor</option>
                  <option value="FINANCEIRO">Financeiro</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Setor</label>
                <select
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500 appearance-none"
                >
                  <option value="">Sem Setor</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Campo opcional de Nova Senha no Editar */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                    <KeyRound size={15} className="text-amber-400" />
                    Nova Senha (Opcional)
                  </label>
                  <span className="text-[11px] text-slate-500">Deixe em branco para não alterar</span>
                </div>
                <input
                  type="password"
                  value={formEditPassword}
                  onChange={(e) => setFormEditPassword(e.target.value)}
                  placeholder="Digite uma nova senha para redefinir"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                >
                  Salvar
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
                Tem certeza? O acesso deste usuário será bloqueado imediatamente, mas seu histórico de ações será mantido no sistema.
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
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 text-white z-50 ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
