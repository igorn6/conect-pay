"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PaymentRequest } from "@/types/database";
import Toast from "@/components/Toast";

function playNotificationSound() {
  try {
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

  const showToastAndSound = (message: string, type: "success" | "error" = "success") => {
    playNotificationSound();
    setToast({ message, type });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Conect Pay", { body: message });
    }
    // Auto hide after 5 seconds
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (!userRole || !userId) return;

    if ("Notification" in window) {
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
            
            if (userRole === "GESTOR" && newRequest.real_requester_id !== userId && newRequest.created_by !== userId) {
              // Wait, Gestor shouldn't be notified on INSERT unless it's VALIDACAO_GESTOR, which normally it isn't.
              // But let's check if they should be notified.
            }

            if (userRole === "FINANCEIRO" || userRole === "MASTER") {
              if (newRequest.created_by !== userId) {
                showToastAndSound(`Nova solicitação de pagamento! R$ ${Number(newRequest.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
                lastNotifyRef.current["master_pending"] = Date.now(); // Reset the 5 min cooldown
              }
            }
          }

          if (payload.eventType === "UPDATE") {
            const newRequest = payload.new as PaymentRequest;
            const oldRequest = payload.old as PaymentRequest;
            
            if (oldRequest && oldRequest.status !== newRequest.status) {
              
              // If it enters a state that requires my attention, notify immediately
              if (userRole === "MASTER" || userRole === "FINANCEIRO") {
                if (newRequest.status === "CORRECAO_PENDENTE") {
                   showToastAndSound(`Atenção: Solicitação enviada para Correção Pendente!`);
                   lastNotifyRef.current["master_pending"] = Date.now();
                }
              }
              
              if (userRole === "GESTOR" && newRequest.status === "VALIDACAO_GESTOR") {
                 // Needs to fetch if it's in their sector, we just force a check next tick by resetting timer
                 lastNotifyRef.current["gestor_pending"] = 0;
                 pollPending();
              }

              // Notify the requester that their own request advanced/receded
              if (newRequest.real_requester_id === userId || newRequest.created_by === userId) {
                const statusName = newRequest.status.replace(/_/g, ' ');
                showToastAndSound(`Seu pedido avançou/retrocedeu para: ${statusName}`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [userRole, userId, sectorId]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    </div>
  );
}
