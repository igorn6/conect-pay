"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import NewRequestModal from "@/components/NewRequestModal";
import CardDetailModal from "@/components/CardDetailModal";
import QuickEditCardModal from "@/components/QuickEditCardModal";
import TrashModal from "@/components/TrashModal";
import Toast from "@/components/Toast";
import MassActionBar from "@/components/MassActionBar";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest, Category } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Plus, Filter, Calendar, Tag, User, X, Layers, TrendingUp } from "lucide-react";
import { computeNextStageHistory } from "@/utils/sla";
import { syncNubankBalance } from "@/lib/nubankClient";
import MagnetButton from "@/components/ui/MagnetButton";

export default function KanbanPage() {
  const { userRole, userId, userName: simulatedUserName, sectorId } = useAuth();
  const { theme } = useTheme();
  const [cards, setCards] = useState<PaymentRequest[]>([]);
  const cardsRef = useRef<PaymentRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PaymentRequest | null>(null);
  const [quickEditCard, setQuickEditCard] = useState<PaymentRequest | null>(null);
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

    const isMasterOrFinanceiro = userRole === "MASTER" || userRole === "FINANCEIRO";

    if (!isMasterOrFinanceiro) {
      if (sectorId) {
        // Busca usuários do mesmo setor para permitir visualização de cards compartilhados
        const { data: sectorUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("sector", sectorId);
          
        const sectorUserIds = new Set(sectorUsers?.map(u => u.id) || []);
        
        filteredData = filteredData.filter((req) => {
          const isMine = req.real_requester_id === userId || req.created_by === userId;
          if (isMine) return true;
          // Se a solicitação for Individual, somente o criador/solicitante pode ver
          if (req.visibility === "INDIVIDUAL") return false;
          // Se for Compartilhada, membros do mesmo setor podem ver
          const isSameSector = sectorUserIds.has(req.real_requester_id) || sectorUserIds.has(req.created_by);
          return isSameSector;
        });
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
          // Sempre refaz o fetch para re-aplicar filtros de setor, data e ordenação
          fetchCards();

          if (payload.eventType === "INSERT") {
            const newRequest = payload.new as PaymentRequest;
            setCards((prev) => {
              if (prev.some((c) => c.id === newRequest.id)) return prev;
              return [newRequest, ...prev];
            });
          }

          if (payload.eventType === "UPDATE") {
            const updatedRequest = payload.new as PaymentRequest;
            setCards((prev) => {
              const prevCard = prev.find((c) => c.id === updatedRequest.id);
              const prevInvoices = (prevCard?.invoice_url || "").split(",").map((u) => u.trim()).filter(Boolean).length;
              const newInvoices = (updatedRequest.invoice_url || "").split(",").map((u) => u.trim()).filter(Boolean).length;

              if (newInvoices > prevInvoices && (userRole === "MASTER" || userRole === "FINANCEIRO")) {
                setToast({
                  message: `📄 Nova notinha anexada em "${updatedRequest.title}" (${newInvoices} ${newInvoices === 1 ? "nota" : "notas"})!`,
                  type: "success",
                });
                if ("Notification" in window && Notification.permission === "granted") {
                  try {
                    new Notification("📄 Nova Notinha Anexada!", {
                      body: `Foi anexada uma notinha fiscal na solicitação "${updatedRequest.title}".`,
                      icon: "/icon.png",
                    });
                  } catch (e) {
                    // ignorar
                  }
                }
              }

              return prev.map((c) => (c.id === updatedRequest.id ? updatedRequest : c));
            });
            setSelectedCard((prev) =>
              prev && prev.id === updatedRequest.id ? updatedRequest : prev
            );
          }

          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setCards((prev) => prev.filter((c) => c.id !== deletedId));
            setSelectedCard((prev) => (prev?.id === deletedId ? null : prev));
          }
        }
      )
      .subscribe();

    // Fallback polling a cada 10s caso WebSocket oscile ou durma
    const pollInterval = setInterval(() => {
      fetchCards();
    }, 10000);

    // Atualiza imediatamente quando a aba volta a ficar visível ou ganha foco
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchCards();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [userRole, userId, fetchCards]);

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
      
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from("payment_requests")
        .update({ is_deleted: true })
        .in("id", idsArray);
        
      if (error) {
        setToast({ message: "Erro ao excluir", type: "error" });
        return;
      }
      // Sincroniza saldo Nubank para estornar qualquer card debitado que foi para a lixeira
      await Promise.all(idsArray.map((id) => syncNubankBalance(id, userId)));

      setToast({ message: selectedIds.size + " solicitações removidas", type: "success" });
      setSelectedIds(new Set());
      fetchCards();
    } 
    else if (action === "RECUSAR") {
      const reason = window.prompt("Motivo da recusa para as " + selectedIds.size + " solicitações:");
      if (!reason || !reason.trim()) return;
      
      const toUpdate = Array.from(selectedIds).map(id => cardsRef.current.find(c => c.id === id)).filter(Boolean);
      let hasError = false;
      
      for (const card of toUpdate) {
        if (!card) continue;
        const nextHistory = computeNextStageHistory(
          card.stage_history,
          "RECUSADO",
          simulatedUserName || "Usuário (Lote)"
        );
        const { error } = await supabase
          .from("payment_requests")
          .update({ 
            status: "RECUSADO",
            refusal_reason: "Recusado em lote: " + reason.trim(),
            stage_history: nextHistory,
          })
          .eq("id", card.id);
        if (error) {
          hasError = true;
        } else {
          syncNubankBalance(card.id, userId);
        }
      }
        
      if (hasError) {
        setToast({ message: "Alguns erros ao recusar", type: "error" });
      } else {
        setToast({ message: selectedIds.size + " solicitações recusadas", type: "success" });
      }
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

      // Validação: Só é permitido avançar para Pendente (EM_APROVACAO) se selecionar o CNPJ ou se é Nubank.
      // (Se for Caju, não é necessário preencher o CNPJ).
      const blockedForCnpj = toUpdate.filter((card) => {
        if (!card || card.status !== "NOVA_SOLICITACAO") return false;
        const splits = Array.isArray(card.splits) && card.splits.length > 0
          ? card.splits
          : [{ payment_type: card.payment_type || card.payment_method }];
        const hasPix = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "PIX") ||
          (card.payment_type || "").toUpperCase() === "PIX" ||
          (card.payment_method || "").toUpperCase() === "PIX";
        const hasBoleto = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "BOLETO") ||
          (card.payment_type || "").toUpperCase() === "BOLETO" ||
          (card.payment_method || "").toUpperCase() === "BOLETO";
        const hasCaju = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "CAJU") ||
          (card.payment_type || "").toUpperCase() === "CAJU" ||
          (card.payment_method || "").toUpperCase() === "CAJU";
        const isCajuOnly = hasCaju && !hasPix && !hasBoleto;
        if (isCajuOnly) return false;
        return !card.cnpj;
      });

      if (blockedForCnpj.length > 0) {
        alert(
          `Não é permitido avançar para Pendente sem selecionar a Conta Pagadora / CNPJ (ou Nubank 02) nas seguintes solicitações:\n\n` +
          blockedForCnpj.map(c => `• ${c?.title || "Sem título"} (R$ ${Number(c?.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`).join("\n") +
          `\n\nPor favor, abra cada solicitação e defina o CNPJ/Nubank 02 antes de aprovar.`
        );
        return;
      }
      
      let hasError = false;
      for (const card of toUpdate) {
        if (!card) continue;
        let next = NEXT_STATUS[card.status as keyof typeof NEXT_STATUS];
        if (card.request_kind === "RECARGA_NUBANK" || card.request_kind === "RECARGA_CAJU") {
          if (card.status === "NOVA_SOLICITACAO") {
            next = "EM_APROVACAO";
          } else if (card.status === "EM_APROVACAO") {
            next = "FINALIZADO";
          }
        }
        if (!next) continue;
        
        const nextHistory = computeNextStageHistory(
          card.stage_history,
          next,
          simulatedUserName || "Usuário (Lote)"
        );

        const { error } = await supabase
          .from("payment_requests")
          .update({ 
            status: next,
            stage_history: nextHistory,
          })
          .eq("id", card.id);
        if (error) {
          hasError = true;
        } else {
          await syncNubankBalance(card.id, userId);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("caju-balance-updated"));
            window.dispatchEvent(new Event("nubank-balance-updated"));
          }
        }
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

  const handleUpdateCategory = async (cardId: string, newCategory: string) => {
    // Atualização otimista
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, category: newCategory } : c))
    );
    const matched = categories.find(
      (c) => c.name.toLowerCase() === newCategory.trim().toLowerCase()
    );
    const { error } = await supabase
      .from("payment_requests")
      .update({
        category: newCategory,
        category_id: matched?.id || null,
      })
      .eq("id", cardId);

    if (error) {
      fetchCards();
      setToast({ message: "Erro ao atualizar categoria.", type: "error" });
    } else {
      setToast({ message: `Categoria alterada para "${newCategory}".`, type: "success" });
    }
  };

  const totalPipelineVolume = cards.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      {/* ─── Control Bar / Telemetry HUD ────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 border-b border-white/[0.08] bg-slate-950/40 backdrop-blur-xl shrink-0 z-10 shadow-sm">
        
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Calendar Month Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-white/10 hover:border-white/20 transition-all text-xs">
            <Calendar size={14} className="text-slate-400" />
            <input 
              type="month" 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-none focus:ring-0 w-36 cursor-pointer"
              title={filterMonth ? "Filtrando por mês específico" : "Todo o período (sem filtro de mês)"}
            />
            {filterMonth && (
              <button
                type="button"
                onClick={() => setFilterMonth("")}
                title="Limpar e ver todo o período"
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              >
                <X size={10} />
                <span>Todos</span>
              </button>
            )}
          </div>

          {/* Category Select */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-white/10 hover:border-white/20 transition-all text-xs">
            <Tag size={14} className="text-slate-400" />
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="bg-transparent text-xs text-white outline-none border-transparent focus:border-transparent focus:ring-0 shadow-none min-w-[130px] cursor-pointer appearance-none"
            >
              <option value="" className="bg-slate-900 text-slate-300">Todas Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
              ))}
            </select>
          </div>

          {/* Requester Select - Somente Master e Financeiro */}
          {(userRole === "MASTER" || userRole === "FINANCEIRO") && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-white/10 hover:border-white/20 transition-all text-xs">
              <User size={14} className="text-slate-400" />
              <select
                value={filterRequesterId}
                onChange={(e) => setFilterRequesterId(e.target.value)}
                className="bg-transparent text-xs text-white outline-none border-transparent focus:border-transparent focus:ring-0 shadow-none min-w-[130px] cursor-pointer appearance-none"
              >
                <option value="" className="bg-slate-900 text-slate-300">Todos Solicitantes</option>
                {Object.entries(profilesMap).map(([id, name]) => (
                  <option key={id} value={id} className="bg-slate-900 text-white">{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Financial Pipeline Metrics & Nova Solicitação */}
        <div className="flex items-center justify-between lg:justify-end gap-3 flex-wrap">
          {/* Telemetry Capsule */}
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Layers size={13} className="text-slate-400" />
              <span>Pipeline: <strong className="font-mono text-white font-semibold">{cards.length}</strong></span>
            </div>
            <div className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <TrendingUp size={13} className="text-slate-400" />
              <span>Volume: <strong className="font-mono text-white font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPipelineVolume)}</strong></span>
            </div>
          </div>

          <MagnetButton
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={15} strokeWidth={3} />
            <span>Nova Solicitação</span>
          </MagnetButton>
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
          categories={categories}
          onUpdateCategory={handleUpdateCategory}
          userRole={userRole || undefined}
          onEditCard={(card) => setQuickEditCard(card)}
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

      {quickEditCard && userRole && (
        <QuickEditCardModal
          isOpen={!!quickEditCard}
          card={quickEditCard}
          userRole={userRole}
          userName={simulatedUserName || "Usuário"}
          userId={userId || ""}
          profilesMap={profilesMap}
          onClose={() => setQuickEditCard(null)}
          onSuccess={(updatedCard, msg) => {
            setQuickEditCard(null);
            fetchCards();
            if (selectedCard && selectedCard.id === updatedCard.id) {
              setSelectedCard(updatedCard);
            }
            handleSuccess(msg || "Solicitação alterada com sucesso!");
          }}
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

