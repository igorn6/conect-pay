"use client";

import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function NotificationPoller() {
  const { userRole, userId, sectorId } = useAuth();
  const [count, setCount] = useState(0);

  const fetchNotificationCount = useCallback(async () => {
    if (!userRole || !userId) return;

    try {
      let currentCount = 0;

      if (userRole === "MASTER" || userRole === "FINANCEIRO") {
        const { count: c } = await supabase
          .from("payment_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["NOVA_SOLICITACAO", "EM_APROVACAO", "VALIDADO_GESTOR", "CORRECAO_PENDENTE"])
          .or("is_deleted.eq.false,is_deleted.is.null");
        
        currentCount = c || 0;
      } else if (userRole === "GESTOR") {
        const { data: sectorUsers } = await supabase.from("profiles").select("id").eq("sector", sectorId);
        const sectorUserIds = sectorUsers?.map(u => u.id) || [];
        
        const { data } = await supabase
          .from("payment_requests")
          .select("id, status, real_requester_id, created_by")
          .in("status", ["NOVA_SOLICITACAO", "VALIDACAO_GESTOR", "AGUARDANDO_PAGAMENTO", "CORRECAO_PENDENTE", "RECUSADO"])
          .or("is_deleted.eq.false,is_deleted.is.null");

        const items = data || [];
        currentCount = items.filter(req => {
          const isMine = req.real_requester_id === userId || req.created_by === userId;
          const isInSector = sectorUserIds.includes(req.real_requester_id) || sectorUserIds.includes(req.created_by);
          
          if (["NOVA_SOLICITACAO", "VALIDACAO_GESTOR"].includes(req.status)) {
            return isInSector || isMine;
          } else {
            return isMine;
          }
        }).length;
      } else {
        const { count: c } = await supabase
          .from("payment_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["AGUARDANDO_PAGAMENTO", "CORRECAO_PENDENTE", "RECUSADO"])
          .or("is_deleted.eq.false,is_deleted.is.null")
          .or(`real_requester_id.eq.${userId},created_by.eq.${userId}`);
          
        currentCount = c || 0;
      }

      setCount(currentCount);

    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    }
  }, [userRole, userId, sectorId]);

  useEffect(() => {
    fetchNotificationCount();
    // Diminui o tempo de polling para 10 segundos para dar um feedback mais rapido
    const interval = setInterval(fetchNotificationCount, 10000);
    
    // Inscreve no supabase para realtime! Para atualizar quase que instantaneamente
    const channel = supabase
      .channel('notif_poller:payment_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => {
        fetchNotificationCount();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotificationCount]);

  useEffect(() => {
    if (count > 0) {
      document.title = `(${count}) Conect Pay`;
      if ('setAppBadge' in navigator) {
        (navigator as any).setAppBadge(count).catch(console.error);
      }
    } else {
      document.title = "Conect Pay";
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(console.error);
      }
    }
  }, [count]);

  return null;
}
