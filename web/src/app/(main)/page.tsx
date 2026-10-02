"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest } from "@/types/database";
import NewRequestModal from "@/components/NewRequestModal";
import Toast from "@/components/Toast";
import HubGreeting from "@/components/hub/HubGreeting";
import HubPendingCards from "@/components/hub/HubPendingCards";
import HubRecentActivity from "@/components/hub/HubRecentActivity";

interface PendingCounts {
  novaSolicitacao: number;
  emAprovacao: number;
  aguardandoPagamento: number;
  recusado: number;
  validacaoGestor: number;
}

export default function HubPage() {
  const { userRole, userId, userName, sectorId } = useAuth();
  const [counts, setCounts] = useState<PendingCounts>({
    novaSolicitacao: 0,
    emAprovacao: 0,
    aguardandoPagamento: 0,
    recusado: 0,
    validacaoGestor: 0,
  });
  const [recentActivities, setRecentActivities] = useState<PaymentRequest[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch profiles map
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) throw new Error("Erro ao buscar perfis");
        const data = await res.json();
        const map: Record<string, string> = {};
        data.forEach((p: any) => (map[p.id] = p.name));
        setProfilesMap(map);
      } catch (err) {
        console.error("Erro ao buscar perfis:", err);
      }
    }
    fetchProfiles();
  }, []);

  // Fetch hub data (counts + recent)
  const fetchHubData = useCallback(async () => {
    if (!userRole || !userId) return;

    try {
      setIsLoading(true);
      const isMasterOrFinanceiro = userRole === "MASTER" || userRole === "FINANCEIRO";
      const isGestor = userRole === "GESTOR";

      // --- Counts ---
      if (isMasterOrFinanceiro) {
        const [novaSol, emAprov, aguardandoPgto] = await Promise.all([
          supabase
            .from("payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "NOVA_SOLICITACAO")
            .or("is_deleted.eq.false,is_deleted.is.null"),
          supabase
            .from("payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "EM_APROVACAO")
            .or("is_deleted.eq.false,is_deleted.is.null"),
          supabase
            .from("payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "AGUARDANDO_PAGAMENTO")
            .or("is_deleted.eq.false,is_deleted.is.null"),
        ]);

        setCounts({
          novaSolicitacao: novaSol.count ?? 0,
          emAprovacao: emAprov.count ?? 0,
          aguardandoPagamento: aguardandoPgto.count ?? 0,
          recusado: 0,
          validacaoGestor: 0,
        });
      } else {
        // Find users in the same sector for validation count
        const { data: sectorUsers } = await supabase.from("profiles").select("id").eq("sector", sectorId);
        const sectorUserIds = sectorUsers?.map((u: any) => u.id) || [];
        
        let validacaoQuery = supabase
          .from("payment_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["NOVA_SOLICITACAO", "VALIDACAO_GESTOR"])
          .or("is_deleted.eq.false,is_deleted.is.null");
          
        if (sectorUserIds.length > 0) {
          validacaoQuery = validacaoQuery.in("real_requester_id", sectorUserIds);
        } else {
          validacaoQuery = validacaoQuery.eq("id", -1);
        }

        const [aguardando, recusado, validacao] = await Promise.all([
          supabase
            .from("payment_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "AGUARDANDO_PAGAMENTO")
            .or("is_deleted.eq.false,is_deleted.is.null")
            .or(`real_requester_id.eq."${userId}",created_by.eq."${userId}"`),
          supabase
            .from("payment_requests")
            .select("id", { count: "exact", head: true })
            .in("status", ["RECUSADO", "CORRECAO_PENDENTE"])
            .or("is_deleted.eq.false,is_deleted.is.null")
            .or(`real_requester_id.eq."${userId}",created_by.eq."${userId}"`),
          isGestor ? validacaoQuery : Promise.resolve({ count: 0 })
        ]);

        setCounts({
          novaSolicitacao: 0,
          emAprovacao: 0,
          aguardandoPagamento: aguardando.count ?? 0,
          recusado: recusado.count ?? 0,
          validacaoGestor: validacao.count ?? 0,
        });
      }

      // --- Recent Activity ---
      let recentQuery = supabase
        .from("payment_requests")
        .select("*")
        .in("status", ["NOVA_SOLICITACAO", "EM_APROVACAO", "VALIDACAO_GESTOR", "CORRECAO_PENDENTE", "VALIDADO_GESTOR", "AGUARDANDO_PAGAMENTO", "FINALIZADO", "RECUSADO"])
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("updated_at", { ascending: false })
        .limit(5);

      if (!isMasterOrFinanceiro) {
        recentQuery = recentQuery.or(`real_requester_id.eq."${userId}",created_by.eq."${userId}"`);
      }

      const { data: recentData, error: recentError } = await recentQuery;

      if (recentError) {
        console.error("Erro ao buscar atividades:", recentError);
        setToast({ message: "Erro ao carregar atividades recentes.", type: "error" });
      } else {
        setRecentActivities(recentData ?? []);
      }
    } catch (err) {
      console.error("Erro no Hub:", err);
      setToast({ message: "Erro de conexão com o banco de dados.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [userRole, userId, sectorId]);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  const handleNewRequestSuccess = () => {
    setIsModalOpen(false);
    setToast({ message: "Solicitação criada com sucesso!", type: "success" });
    fetchHubData(); // Revalida contadores e atividades recentes
  };

  if (!userName) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <HubGreeting
          userName={userName}
          onNewRequest={() => setIsModalOpen(true)}
        />

        <HubPendingCards
          role={userRole || "GESTOR"}
          counts={counts}
          isLoading={isLoading}
        />

        <HubRecentActivity
          activities={recentActivities}
          profilesMap={profilesMap}
          isLoading={isLoading}
        />
      </div>

      {isModalOpen && (
        <NewRequestModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleNewRequestSuccess}
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
