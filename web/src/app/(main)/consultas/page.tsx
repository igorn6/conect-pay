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
      case "NOVA_SOLICITACAO": return <span className="px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-xs font-semibold">Nova</span>;
      case "EM_APROVACAO": return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-md text-xs font-semibold">Em Aprovação</span>;
      case "AGUARDANDO_NOTINHA": return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">Aguardando Notinha</span>;
      case "PAGAMENTO_FINALIZADO": return <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-xs font-semibold">Finalizado</span>;
      case "RECUSADO": return <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-xs font-semibold">Recusado</span>;
      default: return <span className="px-2 py-1 bg-gray-500/10 text-slate-400 border border-gray-500/20 rounded-md text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Consultar Solicitações</h2>
          </div>
          
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800 p-5 rounded-xl border border-slate-700/60 shadow-sm">
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por título, nome, chave pix ou notas..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
              />
            </div>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all appearance-none cursor-pointer"
            >
              <option value="">Todas as Categorias</option>
              {isLoadingCategories ? (
                <option value="" disabled>Carregando categorias...</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))
              )}
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all appearance-none cursor-pointer"
            >
              <option value="">Todos os Status</option>
              <option value="NOVA_SOLICITACAO">Nova Solicitação</option>
              <option value="EM_APROVACAO">Em Aprovação</option>
              <option value="AGUARDANDO_NOTINHA">Aguardando Notinha</option>
              <option value="PAGAMENTO_FINALIZADO">Pagamento Finalizado</option>
              <option value="RECUSADO">Recusado</option>
            </select>
          </div>
          
          {/* Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900/50 border-b border-slate-700/60 text-xs tracking-wider uppercase font-semibold text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Título</th>
                    <th className="px-6 py-4">Solicitante</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex justify-center items-center gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin"></div>
                          <span className="text-slate-400">Carregando dados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <AlertCircle className="mx-auto text-gray-600 mb-3" size={36} />
                        <p className="text-slate-400 text-base font-medium">Nenhuma solicitação encontrada para estes filtros.</p>
                        <p className="text-slate-500 text-sm mt-1">Tente remover alguns filtros para ver mais resultados.</p>
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedCard(req)}
                        className="hover:bg-slate-700/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4.5 font-medium text-slate-200 group-hover:text-white transition-colors">
                          {req.title}
                          {req.payment_type && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-slate-400 tracking-wider">
                              {req.payment_type.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4.5">{profilesMap[req.real_requester_id || ""] || profilesMap[req.created_by] || "Desconhecido"}</td>
                        <td className="px-6 py-4.5">{req.category}</td>
                        <td className="px-6 py-4.5 font-semibold text-slate-200">{formatCurrency(req.amount)}</td>
                        <td className="px-6 py-4.5 text-slate-500">{formatDate(req.created_at)}</td>
                        <td className="px-6 py-4.5">{getStatusBadge(req.status)}</td>
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

