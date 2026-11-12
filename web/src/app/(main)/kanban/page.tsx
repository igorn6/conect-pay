"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import NewRequestModal from "@/components/NewRequestModal";
import CardDetailModal from "@/components/CardDetailModal";
import QuickEditCardModal from "@/components/QuickEditCardModal";
import TrashModal from "@/components/TrashModal";
import Toast from "@/components/Toast";
import MassActionBar from "@/components/MassActionBar";
import { KanbanFilterBar } from "@/components/kanban/KanbanFilterBar";
import { KANBAN_COLUMNS } from "@/constants/kanban";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest, UserRole, UserSector } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import { useKanbanFilters } from "@/hooks/useKanbanFilters";
import { computeNextStageHistory } from "@/utils/sla";
import { syncNubankBalance } from "@/lib/nubankClient";

export default function KanbanPage() {
  const { userRole, userId, userName: simulatedUserName, sectorId } = useAuth();
  const { categories } = useCategories();
  const { profilesMap, profilesList } = useProfilesMap();

  const [allCards, setAllCards] = useState<PaymentRequest[]>([]);
  const allCardsRef = useRef<PaymentRequest[]>([]);
  const [sectors, setSectors] = useState<UserSector[]>([]);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PaymentRequest | null>(null);
  const [quickEditCard, setQuickEditCard] = useState<PaymentRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const requesterSectorById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profilesList) {
      if (p.sector) map[p.id] = p.sector;
    }
    return map;
  }, [profilesList]);

  const sectorUserIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!sectorId) {
      sectorUserIdsRef.current = new Set();
      return;
    }
    sectorUserIdsRef.current = new Set(
      profilesList.filter((p) => p.sector === sectorId).map((p) => p.id)
    );
  }, [profilesList, sectorId]);

  useEffect(() => {
    allCardsRef.current = allCards;
  }, [allCards]);

  useEffect(() => {
    supabase
      .from("sectors")
      .select("id, name, is_deleted")
      .eq("is_deleted", false)
      .order("name")
      .then(({ data }) => {
        if (data) setSectors(data as UserSector[]);
      });
  }, []);

  const {
    filters,
    filteredCards,
    facetCounts,
    activeChips,
    activeFiltersCount,
    advancedFiltersCount,
    hasNonDefaultFilter,
    setScope,
    setSearch,
    setPeriod,
    setCategory,
    setRequesterId,
    setSectorId,
    togglePaymentType,
    setCnpj,
    toggleCondition,
    clearAllFilters,
  } = useKanbanFilters({
    allCards,
    userId,
    userRole: (userRole as UserRole) || null,
    categories,
    profilesMap,
    requesterSectorById,
    sectors,
  });

  const isVisibleToUser = useCallback(
    (req: PaymentRequest): boolean => {
      if (!userRole || !userId) return false;
      if (userRole === "MASTER" || userRole === "FINANCEIRO") return true;
      const isMine = req.real_requester_id === userId || req.created_by === userId;
      if (isMine) return true;
      if (!sectorId) return false;
      if ((req.visibility || "COMPARTILHADA") === "INDIVIDUAL") return false;
      return (
        sectorUserIdsRef.current.has(req.real_requester_id) ||
        sectorUserIdsRef.current.has(req.created_by)
      );
    },
    [userRole, userId, sectorId]
  );

  const requestedMonthRef = useRef<string>("");
  useEffect(() => {
    requestedMonthRef.current = filters.periodMode === "MONTH" ? filters.month : "";
  }, [filters.periodMode, filters.month]);

  const fetchCards = useCallback(async () => {
    if (!userRole || !userId) return;

    const isMasterOrFinanceiro = userRole === "MASTER" || userRole === "FINANCEIRO";
    let sameSectorIds = sectorUserIdsRef.current;

    if (!isMasterOrFinanceiro && sectorId && sameSectorIds.size === 0) {
      const { data: sectorUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("sector", sectorId);
      sameSectorIds = new Set(sectorUsers?.map((u) => u.id) || []);
      sectorUserIdsRef.current = sameSectorIds;
    }

    // Busca todos os cards ativos (sem limite de data) + histórico recente (120 dias)
    // ou o mês histórico selecionado, evitando truncamento silencioso de 1000 linhas.
    const activePromise = supabase
      .from("payment_requests")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .not("status", "in", "(FINALIZADO,RECUSADO)")
      .order("created_at", { ascending: false });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 120);
    let closedStartIso = cutoffDate.toISOString();
    let closedEndIso: string | null = null;

    const selMonth = requestedMonthRef.current;
    if (selMonth && /^\d{4}-\d{2}$/.test(selMonth)) {
      const [y, m] = selMonth.split("-").map(Number);
      const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      if (monthStart < cutoffDate) {
        closedStartIso = monthStart.toISOString();
        closedEndIso = monthEnd.toISOString();
      }
    }

    let closedQuery = supabase
      .from("payment_requests")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .in("status", ["FINALIZADO", "RECUSADO"])
      .gte("created_at", closedStartIso)
      .order("created_at", { ascending: false });

    if (closedEndIso) {
      closedQuery = closedQuery.lte("created_at", closedEndIso);
    }

    const [activeRes, closedRes] = await Promise.all([activePromise, closedQuery]);

    if (activeRes.error || closedRes.error) {
      console.error("Erro ao buscar solicitações:", activeRes.error || closedRes.error);
      setToast({ message: "Erro ao carregar solicitações.", type: "error" });
      return;
    }

    const mergedMap = new Map<string, PaymentRequest>();
    for (const row of [...(activeRes.data || []), ...(closedRes.data || [])]) {
      mergedMap.set(row.id, row as PaymentRequest);
    }

    let merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (!isMasterOrFinanceiro) {
      merged = merged.filter((req) => {
        const isMine = req.real_requester_id === userId || req.created_by === userId;
        if (isMine) return true;
        if (!sectorId) return false;
        if ((req.visibility || "COMPARTILHADA") === "INDIVIDUAL") return false;
        return sameSectorIds.has(req.real_requester_id) || sameSectorIds.has(req.created_by);
      });
    }

    setAllCards(merged);
  }, [userRole, userId, sectorId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Refaz busca quando o usuário seleciona um mês histórico anterior aos últimos 120 dias
  useEffect(() => {
    if (filters.periodMode === "MONTH" && filters.month) {
      fetchCards();
    }
  }, [filters.periodMode, filters.month, fetchCards]);

  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    const visibleIds = new Set(filteredCards.map((c) => c.id));
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (visibleIds.has(id)) next.add(id);
    }
    return next;
  }, [selectedIds, filteredCards]);

  useEffect(() => {
    if (!userRole || !userId) return;

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        fetchCards();
      }, 180);
    };

    const channel = supabase
      .channel("kanban:payment_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        (payload) => {
          scheduleRefetch();

          if (payload.eventType === "INSERT") {
            const newRequest = payload.new as PaymentRequest & { is_deleted?: boolean };
            if (!newRequest.is_deleted && isVisibleToUser(newRequest)) {
              setAllCards((prev) => {
                if (prev.some((c) => c.id === newRequest.id)) return prev;
                return [newRequest, ...prev];
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const updatedRequest = payload.new as PaymentRequest & { is_deleted?: boolean };
            setAllCards((prev) => {
              if (updatedRequest.is_deleted || !isVisibleToUser(updatedRequest)) {
                return prev.filter((c) => c.id !== updatedRequest.id);
              }

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
                  } catch {
                    // ignorar
                  }
                }
              }

              const exists = prev.some((c) => c.id === updatedRequest.id);
              return exists
                ? prev.map((c) => (c.id === updatedRequest.id ? updatedRequest : c))
                : [updatedRequest, ...prev];
            });
            setSelectedCard((prev) =>
              prev && prev.id === updatedRequest.id ? updatedRequest : prev
            );
          }

          if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setAllCards((prev) => prev.filter((c) => c.id !== deletedId));
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
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [userRole, userId, fetchCards, isVisibleToUser]);

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
    if (effectiveSelectedIds.size === 0) return;
    
    if (action === "LIXEIRA") {
      if (!window.confirm("Deseja mover " + effectiveSelectedIds.size + " solicitações para a lixeira?")) return;
      
      const idsArray = Array.from(effectiveSelectedIds);
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

      setToast({ message: effectiveSelectedIds.size + " solicitações removidas", type: "success" });
      setSelectedIds(new Set());
      fetchCards();
    } 
    else if (action === "RECUSAR") {
      const reason = window.prompt("Motivo da recusa para as " + effectiveSelectedIds.size + " solicitações:");
      if (!reason || !reason.trim()) return;
      
      const toUpdate = Array.from(effectiveSelectedIds).map(id => allCardsRef.current.find(c => c.id === id)).filter(Boolean);
      let hasError = false;
      
      for (const card of toUpdate) {
        if (!card) continue;
        const nextHistory = computeNextStageHistory(
          card.stage_history,
          card.status,
          "RECUSADO",
          userId,
          card.created_at
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
        setToast({ message: effectiveSelectedIds.size + " solicitações recusadas", type: "success" });
      }
      setSelectedIds(new Set());
      fetchCards();
    }
    else if (action === "APROVAR") {
      if (!window.confirm("Deseja avançar " + effectiveSelectedIds.size + " solicitações para a próxima etapa?")) return;
      
      const NEXT_STATUS = {
        NOVA_SOLICITACAO: "EM_APROVACAO",
        EM_APROVACAO: "VALIDACAO_GESTOR",
      };
      
      const toUpdate = Array.from(effectiveSelectedIds).map(id => allCardsRef.current.find(c => c.id === id)).filter(Boolean);

      // Validação: Só é permitido avançar para Pendente (EM_APROVACAO) se selecionar o CNPJ ou se é Nubank.
      // (Se for Caju, não é necessário preencher o CNPJ).
      const blockedForCnpj = toUpdate.filter((card) => {
        if (!card || card.status !== "NOVA_SOLICITACAO") return false;
        const splits: { payment_type?: string | null }[] = Array.isArray(card.splits) && card.splits.length > 0
          ? card.splits
          : [{ payment_type: card.payment_type || card.payment_method }];
        const hasPix = splits.some((s) => (s.payment_type || "").toUpperCase() === "PIX") ||
          (card.payment_type || "").toUpperCase() === "PIX" ||
          (card.payment_method || "").toUpperCase() === "PIX";
        const hasBoleto = splits.some((s) => (s.payment_type || "").toUpperCase() === "BOLETO") ||
          (card.payment_type || "").toUpperCase() === "BOLETO" ||
          (card.payment_method || "").toUpperCase() === "BOLETO";
        const hasCaju = splits.some((s) => (s.payment_type || "").toUpperCase() === "CAJU") ||
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
          card.status,
          next,
          userId,
          card.created_at
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
    const matched = categories.find(
      (c) => c.name.toLowerCase() === newCategory.trim().toLowerCase()
    );
    // Atualização otimista
    setAllCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, category: newCategory, category_id: matched?.id || c.category_id }
          : c
      )
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

  const totalPipelineVolume = useMemo(
    () => filteredCards.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
    [filteredCards]
  );

  const emptyColumnsCount = useMemo(() => {
    const countsByStatus: Record<string, number> = {};
    for (const c of filteredCards) {
      countsByStatus[c.status] = (countsByStatus[c.status] || 0) + 1;
    }
    return KANBAN_COLUMNS.filter((col) => !(countsByStatus[col.key] > 0)).length;
  }, [filteredCards]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      <KanbanFilterBar
        userRole={(userRole as UserRole) || null}
        userId={userId}
        sectorId={sectorId}
        filters={filters}
        facetCounts={facetCounts}
        activeChips={activeChips}
        activeFiltersCount={activeFiltersCount}
        advancedFiltersCount={advancedFiltersCount}
        hasNonDefaultFilter={hasNonDefaultFilter}
        totalCardsCount={allCards.length}
        visibleCardsCount={filteredCards.length}
        totalPipelineVolume={totalPipelineVolume}
        categories={categories}
        profilesMap={profilesMap}
        sectors={sectors}
        emptyColumnsCount={emptyColumnsCount}
        hideEmptyColumns={hideEmptyColumns}
        onToggleHideEmptyColumns={() => setHideEmptyColumns((v) => !v)}
        onOpenTrash={() => setIsTrashModalOpen(true)}
        onOpenNewRequest={() => setIsModalOpen(true)}
        onSetScope={setScope}
        onSetSearch={setSearch}
        onSetPeriod={setPeriod}
        onSetCategory={setCategory}
        onSetRequesterId={setRequesterId}
        onSetSectorId={setSectorId}
        onTogglePaymentType={togglePaymentType}
        onSetCnpj={setCnpj}
        onToggleCondition={toggleCondition}
        onClearAllFilters={clearAllFilters}
      />

      <KanbanBoard
        cards={filteredCards}
        onCardClick={setSelectedCard}
        onOpenTrash={() => setIsTrashModalOpen(true)}
        selectable={userRole === "MASTER"}
        selectedIds={effectiveSelectedIds}
        onToggleSelect={handleToggleSelect}
        profilesMap={profilesMap}
        onSelectAllInColumn={handleSelectAllInColumn}
        categories={categories}
        onUpdateCategory={handleUpdateCategory}
        userRole={userRole || undefined}
        onEditCard={(card) => setQuickEditCard(card)}
        hideEmpty={hideEmptyColumns}
        hasActiveFilters={activeFiltersCount > 0}
        totalCardsCount={allCards.length}
        isMineScope={filters.scope === "MINE"}
        allScopeLabel={
          userRole === "MASTER" || userRole === "FINANCEIRO" ? "Todas" : "Do Setor"
        }
        onClearFilters={clearAllFilters}
        onShowAllScope={() => setScope("ALL")}
      />
        {userRole === "MASTER" && (
          <MassActionBar
            selectedCount={effectiveSelectedIds.size}
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

