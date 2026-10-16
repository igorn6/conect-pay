"use client";

import { useState, useEffect } from "react";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import CardDetailModal from "@/components/CardDetailModal";
import NewRequestModal from "@/components/NewRequestModal";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest } from "@/types/database";
import { Search, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
export default function SearchPage() {
  const { userRole, userId, sectorId, userName: simulatedUserName } = useAuth();
  const { categories, isLoading: isLoadingCategories } = useCategories();
  
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  
  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { profilesMap } = useProfilesMap();
  const [selectedCard, setSelectedCard] = useState<PaymentRequest | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("payment_requests")
        .select("*")
        .eq("is_deleted", false)
        .in("status", ["NOVA_SOLICITACAO", "EM_APROVACAO", "VALIDACAO_GESTOR", "CORRECAO_PENDENTE", "VALIDADO_GESTOR", "AGUARDANDO_PAGAMENTO", "FINALIZADO", "RECUSADO"])
        .order("created_at", { ascending: false });
        
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      
      if (categoryFilter) {
        query = query.eq("category", categoryFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Aplicar filtro de isolamento de dados
      let filteredData = data as PaymentRequest[];
      
      if (userRole === "GESTOR") {
        if (sectorId) {
          const { data: sectorUsers } = await supabase.from("profiles").select("id").eq("sector", sectorId);
          const sectorUserIds = new Set(sectorUsers?.map(u => u.id) || []);
          filteredData = filteredData.filter(req => 
            sectorUserIds.has(req.real_requester_id) || sectorUserIds.has(req.created_by) || req.real_requester_id === userId || req.created_by === userId
          );
        } else {
          filteredData = filteredData.filter(req => req.real_requester_id === userId || req.created_by === userId);
        }
      }

      // Client-side text search for multiple fields
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filteredData = filteredData.filter(req => 
          req.title.toLowerCase().includes(lowerTerm) ||
          req.real_requester_id.toLowerCase().includes(lowerTerm) ||
          (req.notes && req.notes.toLowerCase().includes(lowerTerm)) ||
          (req.pix_owner && req.pix_owner.toLowerCase().includes(lowerTerm))
        );
      }
      
      setRequests(filteredData);
    } catch (err) {
      console.error("Erro ao buscar solicitações:", err);
      setToast({ message: "Erro ao carregar dados.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, categoryFilter, searchTerm]);

  const handleSuccess = (msg: string) => {
    setToast({ message: msg, type: "success" });
    fetchRequests();
  };

  // Helper formats
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NOVA_SOLICITACAO": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />Nova</span>;
      case "EM_APROVACAO": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Em Aprovação</span>;
      case "VALIDACAO_GESTOR": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />Validação Gestor</span>;
      case "CORRECAO_PENDENTE": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Correção</span>;
      case "VALIDADO_GESTOR": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />Validado</span>;
      case "AGUARDANDO_PAGAMENTO":
      case "AGUARDANDO_NOTINHA": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Aguardando Pgto</span>;
      case "FINALIZADO":
      case "PAGAMENTO_FINALIZADO": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />Finalizado</span>;
      case "RECUSADO": 
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-300 border border-red-500/20 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Recusado</span>;
      default: 
        return <span className="px-2 py-0.5 bg-white/5 text-slate-400 border border-white/10 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-100">
      <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Consultar Solicitações</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Auditoria e busca multi-parâmetro de registros financeiros</p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300">
              Total: <strong className="text-emerald-400 font-bold">{requests.length}</strong>
            </span>
          </div>
          
          {/* Filters Bar HUD */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 backdrop-blur-xl p-4 rounded-2xl border border-white/[0.08] shadow-lg">
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por título, nome, chave pix ou notas..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20 transition-all font-mono"
              />
            </div>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-white/20 transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">Todas as Categorias</option>
              {isLoadingCategories ? (
                <option value="" disabled className="bg-slate-900">Carregando categorias...</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.name} className="bg-slate-900 text-white">{cat.name}</option>
                ))
              )}
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-white/20 transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">Todos os Status</option>
              <option value="NOVA_SOLICITACAO" className="bg-slate-900 text-white">Nova Solicitação</option>
              <option value="VALIDACAO_GESTOR" className="bg-slate-900 text-white">Validação Gestor</option>
              <option value="EM_APROVACAO" className="bg-slate-900 text-white">Em Aprovação</option>
              <option value="CORRECAO_PENDENTE" className="bg-slate-900 text-white">Correção Pendente</option>
              <option value="VALIDADO_GESTOR" className="bg-slate-900 text-white">Validado Gestor</option>
              <option value="AGUARDANDO_PAGAMENTO" className="bg-slate-900 text-white">Aguardando Pagamento</option>
              <option value="FINALIZADO" className="bg-slate-900 text-white">Finalizado</option>
              <option value="RECUSADO" className="bg-slate-900 text-white">Recusado</option>
            </select>
          </div>
          
          {/* Table */}
          <div className="bg-slate-950/60 backdrop-blur-xl rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/[0.02] border-b border-white/[0.08] text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Título</th>
                    <th className="px-4 py-3.5">Solicitante</th>
                    <th className="px-4 py-3.5">Categoria</th>
                    <th className="px-4 py-3.5 text-right font-mono">Valor</th>
                    <th className="px-4 py-3.5 font-mono">Data</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex justify-center items-center gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                          <span className="text-slate-400 font-mono text-xs">Consultando base de dados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <AlertCircle className="mx-auto text-slate-600 mb-2.5" size={32} />
                        <p className="text-slate-300 text-sm font-semibold">Nenhuma solicitação encontrada</p>
                        <p className="text-slate-500 text-xs mt-1 font-mono">Tente ajustar seus termos de busca ou filtros.</p>
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedCard(req)}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-200 group-hover:text-white transition-colors max-w-xs truncate">
                          {req.title}
                          {req.payment_type && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-white/[0.05] border border-white/10 text-slate-400 tracking-wider">
                              {req.payment_type.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{profilesMap[req.real_requester_id || ""] || profilesMap[req.created_by] || "Desconhecido"}</td>
                        <td className="px-4 py-3.5">
                          {req.category ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] border border-white/10 text-slate-300">
                              {req.category}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {formatCurrency(req.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">{formatDate(req.created_at)}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(req.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {isNewModalOpen && (
        <NewRequestModal 
          onClose={() => setIsNewModalOpen(false)}
          onSave={() => handleSuccess("Solicitação criada com sucesso!")}
        />
      )}
      
      {selectedCard && userRole && simulatedUserName && (
        <CardDetailModal
          card={selectedCard}
          userRole={userRole}
          simulatedUserName={simulatedUserName}
          profilesMap={profilesMap}
          onClose={() => setSelectedCard(null)}
          onUpdate={(msg) => handleSuccess(msg || "Solicitação atualizada!")}
        />
      )}
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

