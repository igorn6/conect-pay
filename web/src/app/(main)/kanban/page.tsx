"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import NewRequestModal from "@/components/NewRequestModal";
import CardDetailModal from "@/components/CardDetailModal";
import TrashModal from "@/components/TrashModal";
import Toast from "@/components/Toast";
import MassActionBar from "@/components/MassActionBar";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest, Category } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Plus, Filter, Calendar, Tag, User, X } from "lucide-react";

export default function KanbanPage() {
  const { userRole, userId, userName: simulatedUserName, sectorId } = useAuth();
  const { theme } = useTheme();
  const [cards, setCards] = useState<PaymentRequest[]>([]);
  const cardsRef = useRef<PaymentRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PaymentRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Filters State - padrão vazio para carregar todo o período
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterRequesterId, setFilterRequesterId] = useState<string>("");

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    supabase.from("profiles").select("id, name").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => map[p.id] = p.name);
        setProfilesMap(map);
      }
    });

    supabase.from("categories").select("*").then(({ data }) => {
      if (data) {
        setCategories(data as Category[]);
      }
    });
  }, []);

  const fetchCards = useCallback(async () => {
    if (!userRole || !userId) return;

    let query = supabase
      .from("payment_requests")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false });

    if (filterMonth) {
      const [year, month] = filterMonth.split("-");
      const start = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).toISOString();
      query = query.gte("created_at", start).lte("created_at", end);
    }

    if (filterCategoryId) {
      query = query.eq("category_id", filterCategoryId);
    }

    if (filterRequesterId) {
      query = query.eq("real_requester_id", filterRequesterId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar solicitações:", error);
      setToast({ message: "Erro ao carregar solicitações.", type: "error" });
      return;
    }

    let filteredData = (data as any[]) ?? [];

    if (userRole === "GESTOR" && !filterRequesterId) {
      if (sectorId) {
        // Fetch users in the same sector to filter
        const { data: sectorUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("sector", sectorId);
          
        const sectorUserIds = new Set(sectorUsers?.map(u => u.id) || []);
        
        filteredData = filteredData.filter((req) => 
          sectorUserIds.has(req.real_requester_id) || req.real_requester_id === userId || req.created_by === userId
        );
      } else {
        filteredData = filteredData.filter((req) => 
          req.real_requester_id === userId || req.created_by === userId
        );
      }
    }

    setCards(filteredData);
  }, [userRole, userId, sectorId, filterMonth, filterCategoryId, filterRequesterId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    if (!userRole || !userId) return;

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("kanban:payment_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
              const newRequest = payload.new as PaymentRequest;
              if (userRole === "GESTOR" && newRequest.real_requester_id !== userId && newRequest.created_by !== userId) {
                return;
              }
              setCards((prev) => {
                  if (prev.some(c => c.id === newRequest.id)) return prev;
                  return [newRequest, ...prev];
              });
            }

            if (payload.eventType === "UPDATE") {
              const updatedRequest = payload.new as PaymentRequest;
              setCards((prev) =>
                prev.map((c) => (c.id === updatedRequest.id ? updatedRequest : c))
              );
            }

          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setCards((prev) => prev.filter(c => c.id !== deletedId));
            setSelectedCard(prev => (prev?.id === deletedId ? null : prev));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, userId]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllInColumn = (ids: string[], isAdding: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAdding) {
        ids.forEach(id => next.add(id));
      } else {
        ids.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const handleMassAction = async (action: "APROVAR" | "RECUSAR" | "LIXEIRA" | "MOVER") => {
    if (selectedIds.size === 0) return;
    
    if (action === "LIXEIRA") {
      if (!window.confirm("Deseja mover " + selectedIds.size + " solicitações para a lixeira?")) return;
      
      const { error } = await supabase
        .from("payment_requests")
        .update({ is_deleted: true })
        .in("id", Array.from(selectedIds));
        
      if (error) {
        setToast({ message: "Erro ao excluir", type: "error" });
        return;
      }
      setToast({ message: selectedIds.size + " solicitações removidas", type: "success" });
      setSelectedIds(new Set());
      fetchCards();
    } 
    else if (action === "RECUSAR") {
      const reason = window.prompt("Motivo da recusa para as " + selectedIds.size + " solicitações:");
      if (!reason || !reason.trim()) return;
      
      const { error } = await supabase
        .from("payment_requests")
        .update({ 
          status: "RECUSADO",
          refusal_reason: "Recusado em lote: " + reason.trim()
        })
        .in("id", Array.from(selectedIds));
        
      if (error) {
        setToast({ message: "Erro ao recusar", type: "error" });
        return;
      }
      setToast({ message: selectedIds.size + " solicitações recusadas", type: "success" });
      setSelectedIds(new Set());
      fetchCards();
    }
    else if (action === "APROVAR") {
      if (!window.confirm("Deseja avançar " + selectedIds.size + " solicitações para a próxima etapa?")) return;
      
      const NEXT_STATUS = {
        NOVA_SOLICITACAO: "EM_APROVACAO",
        EM_APROVACAO: "VALIDACAO_GESTOR",
      };
      
      const toUpdate = Array.from(selectedIds).map(id => cardsRef.current.find(c => c.id === id)).filter(Boolean);
      
      let hasError = false;
      for (const card of toUpdate) {
        if (!card) continue;
        const next = NEXT_STATUS[card.status as keyof typeof NEXT_STATUS];
        if (!next) continue;
        
        const { error } = await supabase.from("payment_requests").update({ status: next }).eq("id", card.id);
        if (error) hasError = true;
      }
      
      if (hasError) setToast({ message: "Alguns erros ao avançar", type: "error" });
      else setToast({ message: toUpdate.length + " solicitações avançadas", type: "success" });
      
      setSelectedIds(new Set());
      fetchCards();
    }
  };

  const handleSuccess = (message: string) => {
    setIsModalOpen(false);
    setSelectedCard(null);
    setToast({ message, type: "success" });
    fetchCards(); 
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b border-slate-800 bg-slate-900 shrink-0">
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="month" 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-sm text-white outline-none border-none focus:ring-0 w-44 min-w-[140px]"
              title={filterMonth ? "Filtrando por mês específico" : "Todo o período (sem filtro de mês)"}
            />
            {filterMonth && (
              <button
                type="button"
                onClick={() => setFilterMonth("")}
                title="Limpar e ver todo o período"
                className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors cursor-pointer"
              >
                <X size={12} />
                <span className="text-[11px]">Todos</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
            <Tag size={16} className="text-slate-400" />
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="bg-transparent text-sm text-white outline-none border-transparent focus:border-transparent focus:ring-0 shadow-none min-w-[120px] cursor-pointer appearance-none"
            >
              <option value="" className="bg-slate-800">Todas Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-800">{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
            <User size={16} className="text-slate-400" />
            <select
              value={filterRequesterId}
              onChange={(e) => setFilterRequesterId(e.target.value)}
              className="bg-transparent text-sm text-white outline-none border-transparent focus:border-transparent focus:ring-0 shadow-none min-w-[120px] cursor-pointer appearance-none"
            >
              <option value="" className="bg-slate-800">Todos Solicitantes</option>
              {Object.entries(profilesMap).map(([id, name]) => (
                <option key={id} value={id} className="bg-slate-800">{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full md:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center justify-center w-full md:w-auto gap-2 px-5 py-2.5 text-sm font-semibold cursor-pointer shadow-md transition-all active:scale-95 text-white border-none ${
                theme === 'authkit'
                  ? 'bg-[#663af3] hover:opacity-90 rounded-full shadow-[0_0_20px_rgba(102,58,243,0.4)]'
                  : theme === 'n8n'
                  ? 'bg-[image:var(--gradient-ember-cta)] shadow-[0_0_15px_rgba(253,137,37,0.4)] rounded-lg'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 rounded-lg'
              }`}
          >
            <Plus size={18} strokeWidth={2.5} />
            Nova Solicitação
          </button>
        </div>

      </div>
      
      <KanbanBoard 
          cards={cards} 
          onCardClick={setSelectedCard} 
          onOpenTrash={() => setIsTrashModalOpen(true)}
          selectable={userRole === "MASTER"}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          profilesMap={profilesMap}
          onSelectAllInColumn={handleSelectAllInColumn}
        />
        {userRole === "MASTER" && (
          <MassActionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onAction={handleMassAction}
          />
        )}

      {isModalOpen && (
        <NewRequestModal
          onClose={() => setIsModalOpen(false)}
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

      {isTrashModalOpen && simulatedUserName && (
        <TrashModal 
          simulatedUserName={simulatedUserName}
          userId={userId || undefined}
          userRole={(userRole as string) || undefined}
          onClose={() => setIsTrashModalOpen(false)} 
          onUpdate={() => {
            fetchCards();
            setToast({ message: "Lixeira atualizada.", type: "success" });
          }}
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

