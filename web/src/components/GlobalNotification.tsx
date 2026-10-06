"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PaymentRequest } from "@/types/database";
import Toast from "@/components/Toast";
import { registerServiceWorker } from "@/lib/pushNotifications";
import { getStatusLabel } from "@/constants/kanban";

function playNotificationSound() {
  try {
    const isMuted = typeof window !== "undefined" && localStorage.getItem("conectpay_mute_sounds") === "true";
    if (isMuted) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("AudioContext not supported or blocked");
  }
}

export default function GlobalNotification() {
  const { userRole, userId, sectorId } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const lastNotifyRef = useRef<{ [type: string]: number }>({});
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const knownStatusesRef = useRef<Map<string, string>>(new Map());

  const showToastAndSound = useCallback((message: string, type: "success" | "error" = "success") => {
    playNotificationSound();
    setToast({ message, type });

    // Tentar exibir notificação nativa pelo Service Worker (mais persistente no SO)
    if (swRegRef.current && "showNotification" in swRegRef.current) {
      swRegRef.current.showNotification("Conect Pay", {
        body: message,
        icon: "/logo-dark.png",
        badge: "/logo-dark.png",
        tag: "conectpay-inapp",
      }).catch(() => {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Conect Pay", { body: message });
        }
      });
    } else if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Conect Pay", { body: message });
    }

    // Auto hide toast after 5 seconds
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (!userRole || !userId) return;

    // Registrar o Service Worker para garantir suporte a notificações de sistema e Push
    registerServiceWorker().then((reg) => {
      if (reg) swRegRef.current = reg;
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 1. Polling for recurring 5-min notifications
    const pollPending = async () => {
      const now = Date.now();
      const FIVE_MINS = 5 * 60 * 1000;
      
      try {
        if (userRole === "MASTER" || userRole === "FINANCEIRO") {
          // Master/Financeiro checks for NOVA_SOLICITACAO and CORRECAO_PENDENTE
          if (now - (lastNotifyRef.current["master_pending"] || 0) >= FIVE_MINS) {
            const { count } = await supabase
              .from("payment_requests")
              .select("id", { count: "exact", head: true })
              .in("status", ["NOVA_SOLICITACAO", "CORRECAO_PENDENTE"])
              .or("is_deleted.eq.false,is_deleted.is.null");
              
            if (count && count > 0) {
              showToastAndSound(`Você tem ${count} solicitação(ões) pendente(s) (Nova ou Correção)`);
              lastNotifyRef.current["master_pending"] = now;
            }
          }
        } else if (userRole === "GESTOR") {
          if (now - (lastNotifyRef.current["gestor_pending"] || 0) >= FIVE_MINS) {
             const { data: sectorUsers } = await supabase.from("profiles").select("id").eq("sector", sectorId);
             const sectorUserIds = sectorUsers?.map(u => u.id) || [];
             
             const { data } = await supabase
              .from("payment_requests")
              .select("id, real_requester_id, created_by")
              .eq("status", "VALIDACAO_GESTOR")
              .or("is_deleted.eq.false,is_deleted.is.null");
              
             const items = data || [];
             const pendingForMe = items.filter(req => sectorUserIds.includes(req.real_requester_id) || sectorUserIds.includes(req.created_by));
             
             if (pendingForMe.length > 0) {
               showToastAndSound(`Existem ${pendingForMe.length} solicitação(ões) aguardando sua validação como gestor.`);
               lastNotifyRef.current["gestor_pending"] = now;
             }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    // Pré-carregar status atuais dos cards para evitar notificações falsas em edições/anexos
    supabase
      .from("payment_requests")
      .select("id, status")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .then(({ data }) => {
        if (data) {
          data.forEach((r) => knownStatusesRef.current.set(r.id, r.status));
        }
      });

    pollPending();
    const intervalId = setInterval(pollPending, 10000); // Check every 10s, cooldown handles the 5min

    // 2. Realtime listener for immediate notifications
    const channel = supabase
      .channel("global:notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRequest = payload.new as PaymentRequest;
            knownStatusesRef.current.set(newRequest.id, newRequest.status);

            if (userRole === "FINANCEIRO" || userRole === "MASTER") {
              if (newRequest.created_by !== userId) {
                showToastAndSound(`Nova solicitação de pagamento! R$ ${Number(newRequest.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
                lastNotifyRef.current["master_pending"] = Date.now(); // Reset the 5 min cooldown
              }
            }
          }

          if (payload.eventType === "UPDATE") {
            const newRequest = payload.new as PaymentRequest;
            const oldRequest = payload.old as Partial<PaymentRequest>;
            
            // Descobre o status anterior (via payload.old ou pelo cache em memória)
            const oldStatus = oldRequest?.status || knownStatusesRef.current.get(newRequest.id);
            const newStatus = newRequest.status;

            // Atualiza cache em memória com o novo status
            knownStatusesRef.current.set(newRequest.id, newStatus);

            // SE O STATUS NÃO MUDOU (ex: apenas anexou comprovante, notinha ou editou campo), NÃO NOTIFICA NADA!
            if (oldStatus && oldStatus === newStatus) {
              return;
            }

            // Notifica MASTER / FINANCEIRO se entrar em Correção Pendente ou Validado pelo Gestor
            if (userRole === "MASTER" || userRole === "FINANCEIRO") {
              if (newStatus === "CORRECAO_PENDENTE") {
                showToastAndSound(`Atenção: Solicitação enviada para Correção Pendente!`);
                lastNotifyRef.current["master_pending"] = Date.now();
              } else if (newStatus === "VALIDADO_GESTOR") {
                showToastAndSound(`Solicitação validada pelo gestor e pronta para pagamento!`);
              }
            }
            
            // Notifica GESTOR se entrar em Validação do Gestor
            if (userRole === "GESTOR" && newStatus === "VALIDACAO_GESTOR") {
              lastNotifyRef.current["gestor_pending"] = 0;
              pollPending();
            }

            // Notifica o solicitante/criador do pedido
            if (newRequest.real_requester_id === userId || newRequest.created_by === userId) {
              const friendlyStatus = getStatusLabel(newStatus);
              if (newStatus === "FINALIZADO") {
                showToastAndSound(`Seu pedido foi finalizado com sucesso!`);
              } else if (newStatus === "RECUSADO") {
                showToastAndSound(`Seu pedido foi recusado.`);
              } else if (newStatus === "CORRECAO_PENDENTE") {
                showToastAndSound(`Atenção: Seu pedido precisa de correção.`);
              } else {
                showToastAndSound(`Seu pedido avançou para: ${friendlyStatus}`);
              }
            }
          }
        }
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollPending();
      }
    };
    const handleFocus = () => {
      pollPending();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [userRole, userId, sectorId, showToastAndSound]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    </div>
  );
}
