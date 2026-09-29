const fs = require('fs');
const path = require('path');

const code = `"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { PaymentRequest } from "@/types/database";
import Toast from "@/components/Toast";

export default function GlobalNotification() {
  const { userRole, userId } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!userRole || !userId) return;

    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("global:notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRequest = payload.new as PaymentRequest;
            
            if (userRole === "GESTOR" && newRequest.real_requester_id !== userId && newRequest.created_by !== userId) {
              return;
            }

            if (userRole === "FINANCEIRO" || userRole === "MASTER") {
              if (newRequest.created_by !== userId) {
                setToast({ message: "Nova solicita\u00e7\u00e3o de pagamento!", type: "success" });
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Nova Solicita\u00e7\u00e3o", {
                    body: \`Novo pedido de R$ \${newRequest.amount} criado.\`,
                  });
                }
              }
            }
          }

          if (payload.eventType === "UPDATE") {
            const newRequest = payload.new as PaymentRequest;
            const oldRequest = payload.old as PaymentRequest;
            
            if (oldRequest && oldRequest.status !== newRequest.status) {
              if (newRequest.real_requester_id === userId || newRequest.created_by === userId) {
                const statusName = newRequest.status.replace(/_/g, ' ');
                setToast({ message: \`Seu pedido avan\u00e7ou para: \${statusName}\`, type: "success" });
                
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Seu Pedido Atualizou!", {
                    body: \`O status agora \u00e9: \${statusName}\`,
                  });
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, userId]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    </div>
  );
}
`;

fs.writeFileSync(path.join(process.cwd(), "src/components/GlobalNotification.tsx"), code);
console.log("GlobalNotification.tsx created.");
